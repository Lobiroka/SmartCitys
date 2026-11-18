from datetime import datetime, timezone
from pathlib import Path

import psycopg
from psycopg.types.json import Jsonb

from src.config import DATABASE_URL, require_config
from src.data_quality import validate_indicators, validate_occurrences


DDL = Path(__file__).resolve().parent.parent / "sql" / "smartcity_analytics.sql"


def publish_product(data: dict, run: dict) -> dict:
    indicators = data["ibge"]
    occurrences = validate_occurrences(data["ocorrencias"])
    validate_indicators(indicators)
    updated = datetime.now(timezone.utc)
    with psycopg.connect(require_config("DATABASE_URL", DATABASE_URL), connect_timeout=10) as conn:
        with conn.cursor() as cursor:
            cursor.execute("SET LOCAL statement_timeout = '60s'")
            cursor.execute("SELECT pg_advisory_xact_lock(2611606, 2010)")
            cursor.execute(DDL.read_text())
            cursor.execute("SELECT MAX(inicio) FROM public.smartcity_pipeline_execucoes")
            latest = cursor.fetchone()[0]
            started = datetime.fromisoformat(run["inicio"])
            if latest is not None and latest > started:
                raise ValueError("Execução mais antiga que o snapshot publicado; publicação recusada.")
            cursor.executemany("""
                INSERT INTO public.smartcity_ibge_bairros VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (codigo_bairro) DO UPDATE SET
                    bairro=EXCLUDED.bairro, populacao=EXCLUDED.populacao,
                    domicilios_total=EXCLUDED.domicilios_total,
                    domicilios_rede_geral=EXCLUDED.domicilios_rede_geral,
                    percentual_rede_esgoto=EXCLUDED.percentual_rede_esgoto,
                    ano=EXCLUDED.ano, lote_id=EXCLUDED.lote_id, atualizado_em=EXCLUDED.atualizado_em
            """, [(r["codigo_bairro"],r["bairro"],r["populacao"],r["domicilios_total"],
                   r["domicilios_rede_geral"],r["percentual_rede_esgoto"],r["ano"],
                   run["lotes"]["populacao"],updated) for r in indicators])
            cursor.executemany("""
                INSERT INTO public.smartcity_ocorrencias VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (id_denuncia) DO UPDATE SET
                    categoria=EXCLUDED.categoria, regiao=EXCLUDED.regiao, status=EXCLUDED.status,
                    prioridade=EXCLUDED.prioridade, data_registro=EXCLUDED.data_registro,
                    lote_id=EXCLUDED.lote_id, atualizado_em=EXCLUDED.atualizado_em
            """, [(r["id_denuncia"],r["categoria"],r["regiao"],r["status"],r["prioridade"],
                   r["data_registro"],run["lotes"]["ocorrencias"],updated) for r in occurrences])
            cursor.execute("DELETE FROM public.smartcity_ocorrencias WHERE NOT (id_denuncia = ANY(%s))",
                           ([r["id_denuncia"] for r in occurrences],))
            cursor.execute("DELETE FROM public.smartcity_ibge_bairros WHERE NOT (codigo_bairro = ANY(%s))",
                           ([r["codigo_bairro"] for r in indicators],))
            cursor.execute("SELECT (SELECT COUNT(*) FROM public.smartcity_ibge_bairros), "
                           "(SELECT COUNT(*) FROM public.smartcity_ocorrencias)")
            counts = cursor.fetchone()
            if counts != (len(indicators), len(occurrences)):
                raise RuntimeError("Contagem prata divergente; transação será revertida.")
            cursor.execute("""
                INSERT INTO public.smartcity_pipeline_execucoes VALUES (%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (execucao_id) DO UPDATE SET publicado_em=EXCLUDED.publicado_em
            """, (run["execucao_id"],started,updated,data["motor"],Jsonb(run["lotes"]),*counts))
    return {"execucao_id": run["execucao_id"], "bairros": counts[0], "ocorrencias": counts[1],
            "motor": data["motor"]}
