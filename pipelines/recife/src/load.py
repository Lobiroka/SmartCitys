import hashlib
import json
from datetime import datetime, timezone

import pandas as pd
import psycopg
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from psycopg import sql
from psycopg.types.json import Jsonb
from src.geography import BOUNDARIES_URL

from src.config import DATABASE_URL, MONGODB_URI, require_config

class Load:

    def __init__(self):
        self.mongo_uri = require_config("MONGODB_URI", MONGODB_URI)
        self.database_url = require_config("DATABASE_URL", DATABASE_URL)

        self.client = MongoClient(
            self.mongo_uri,
            server_api=ServerApi("1"),
            serverSelectionTimeoutMS=10000
        )

    def close(self) -> None:

        self.client.close()

    def load_mongo(
        self,
        data: list[dict],
        db_name: str,
        collection_name: str,
        source: str | None = None,
    ) -> str:
        """Persiste um snapshot bruto sem duplicar reexecuções do mesmo conteúdo.

        Uma versão cabe em um documento (o recorte atual tem 94 bairros).
        O índice único de _id do MongoDB torna o upsert atômico e idempotente.
        Documentos legados não são removidos.
        """
        if not data or not any(str(item.get("D1C", "")).strip().isdigit() or item.get("type") == "Feature" for item in data):
            raise ValueError("Carga bronze vazia ou sem bairros válidos")
        # APRESENTAÇÃO ETL — bronze e idempotência: o SHA-256 identifica esta
        # resposta bruta. O _id único e o upsert reutilizam o snapshot quando
        # o conteúdo é igual; somente ultima_observacao muda na nova consulta.
        canonical = json.dumps(data, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
        snapshot_id = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        now = datetime.now(timezone.utc)
        self.client[db_name][collection_name].update_one(
            {"_id": snapshot_id},
            {
                "$setOnInsert": {
                    "tipo": "bronze_snapshot",
                    "registros": data,
                    "data_extracao": now,
                    "fonte": source or ("Prefeitura do Recife" if data[0].get("type") == "Feature" else "IBGE/SIDRA"),
                },
                "$set": {"ultima_observacao": now},
            },
            upsert=True,
        )
        print(f"MongoDB: snapshot bronze persistido em '{collection_name}'.")
        return snapshot_id

    def load_neondb(
        self,
        df: pd.DataFrame,
        nome_tabela: str = "recife_populacao_saneamento",
        boundaries: list[dict] | None = None,
    ) -> None:

        if df.empty:
            raise ValueError("Carga prata vazia: tabela existente preservada")
        if df["codigo_bairro"].isna().any() or df["codigo_bairro"].duplicated().any():
            raise ValueError("Códigos de bairro ausentes ou duplicados")
        if boundaries is not None and (
            len(boundaries) != len(df)
            or {row["codigo_bairro"] for row in boundaries} != set(df["codigo_bairro"])
        ):
            raise ValueError("Limites e indicadores com códigos divergentes")
        table = sql.Identifier("public", nome_tabela)
        create_table_sql = sql.SQL("""
        CREATE TABLE IF NOT EXISTS {table} (
            codigo_bairro VARCHAR(20) PRIMARY KEY,
            bairro VARCHAR(255),
            populacao INTEGER,
            domicilios_total INTEGER,
            domicilios_rede_geral INTEGER,
            percentual_rede_esgoto NUMERIC(5, 2),
            ano INTEGER,
            data_extracao TIMESTAMPTZ
        );

        ALTER TABLE {table}
            ADD COLUMN IF NOT EXISTS data_extracao TIMESTAMPTZ;
        """).format(table=table)

        # APRESENTAÇÃO ETL — prata: codigo_bairro é a chave. ON CONFLICT faz
        # upsert: insere um bairro novo ou atualiza o existente, sem duplicá-lo.
        # A conexão abaixo publica os indicadores e os limites em uma transação.
        insert_sql = sql.SQL("""
        INSERT INTO {table} (
            codigo_bairro,
            bairro,
            populacao,
            domicilios_total,
            domicilios_rede_geral,
            percentual_rede_esgoto,
            ano,
            data_extracao
        )
        VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s
        )
        ON CONFLICT (codigo_bairro)
        DO UPDATE SET
            bairro = EXCLUDED.bairro,
            populacao = EXCLUDED.populacao,
            domicilios_total = EXCLUDED.domicilios_total,
            domicilios_rede_geral = EXCLUDED.domicilios_rede_geral,
            percentual_rede_esgoto = EXCLUDED.percentual_rede_esgoto,
            ano = EXCLUDED.ano,
            data_extracao = EXCLUDED.data_extracao;
        """).format(table=table)

        with psycopg.connect(self.database_url, connect_timeout=10) as conn:

            with conn.cursor() as cursor:

                cursor.execute("SET LOCAL lock_timeout = '3s'")
                cursor.execute("SET LOCAL statement_timeout = '15s'")
                cursor.execute(create_table_sql)

                for _, row in df.iterrows():

                    cursor.execute(
                        insert_sql,
                        (
                            row["codigo_bairro"],
                            row["bairro"],
                            None if pd.isna(row["populacao"]) else int(row["populacao"]),
                            None if pd.isna(row["domicilios_total"]) else int(row["domicilios_total"]),
                            None if pd.isna(row["domicilios_rede_geral"]) else int(row["domicilios_rede_geral"]),
                            None if pd.isna(row["percentual_rede_esgoto"]) else float(row["percentual_rede_esgoto"]),
                            int(row["ano"]),
                            pd.to_datetime(row["data_extracao"], utc=True).to_pydatetime(),
                        )
                    )

                cursor.execute(sql.SQL("SELECT COUNT(*) FROM {}").format(table))
                if cursor.fetchone()[0] != len(df):
                    raise ValueError("Contagem prata divergente: transação revertida")
                if boundaries is not None:
                    cursor.execute("""CREATE TABLE IF NOT EXISTS public.recife_bairros_limites (
                        codigo_bairro VARCHAR(20) PRIMARY KEY,
                        geometria JSONB NOT NULL,
                        fonte TEXT NOT NULL,
                        data_extracao TIMESTAMPTZ NOT NULL
                    )""")
                    for boundary in boundaries:
                        cursor.execute("""INSERT INTO public.recife_bairros_limites
                            (codigo_bairro, geometria, fonte, data_extracao)
                            VALUES (%s, %s, %s, %s)
                            ON CONFLICT (codigo_bairro) DO UPDATE SET
                                geometria = EXCLUDED.geometria, fonte = EXCLUDED.fonte,
                                data_extracao = EXCLUDED.data_extracao""", (
                            boundary["codigo_bairro"], Jsonb(json.loads(boundary["geometria"])),
                            BOUNDARIES_URL, boundary["data_extracao"],
                        ))
                    cursor.execute("SELECT COUNT(*) FROM public.recife_bairros_limites")
                    if cursor.fetchone()[0] != len(boundaries):
                        raise ValueError("Contagem de limites divergente: transação revertida")
            conn.commit()

        print(
            f"NeonDB: tabela '{nome_tabela}' "
            f"atualizada com sucesso."
        )

    def count_neondb(
        self,
        nome_tabela: str = "recife_populacao_saneamento",
    ) -> int:
        with psycopg.connect(self.database_url, connect_timeout=10) as conn:
            with conn.cursor() as cursor:
                cursor.execute(sql.SQL("SELECT COUNT(*) FROM {}").format(sql.Identifier("public", nome_tabela)))
                return cursor.fetchone()[0]
