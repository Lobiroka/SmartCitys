import math
import re
import unicodedata

import psycopg
import requests

from src.config import DATABASE_URL, SPARK_MASTER, require_config

SOURCE = "esig_emlurb_recife"
QUERY_URL = (
    "https://esigportal2.recife.pe.gov.br/arcgis/rest/services/"
    "COP/BASES_FEATURES_COP_CONSULTA/FeatureServer/1/query"
)


def _query(session, **params):
    response = session.get(QUERY_URL, params=params, timeout=(10, 45))
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, dict) or "error" in data or data.get("exceededTransferLimit"):
        raise ValueError("ESIG retornou erro ou uma resposta truncada.")
    return data


def _feature_id(feature):
    properties = feature.get("properties") or {}
    return properties.get("OBJECTID", feature.get("id"))


def extract_flood_points():
    with requests.Session() as session:
        ids = _query(session, where="1=1", returnIdsOnly="true", f="json").get("objectIds")
        if not isinstance(ids, list) or not ids or any(type(key) is not int or key <= 0 for key in ids):
            raise ValueError("ESIG: lista de identificadores vazia ou inválida.")
        if len(ids) != len(set(ids)):
            raise ValueError("ESIG: identificadores duplicados.")
        features = []
        for start in range(0, len(ids), 200):
            batch = ids[start:start + 200]
            data = _query(session, objectIds=",".join(map(str, batch)),
                          outFields="OBJECTID,BAIRRO,RPA", returnGeometry="true",
                          outSR=4326, f="geojson")
            rows = data.get("features")
            if data.get("type") != "FeatureCollection" or not isinstance(rows, list):
                raise ValueError("ESIG: resposta GeoJSON inválida.")
            if len(rows) != len(batch) or {_feature_id(row) for row in rows} != set(batch):
                raise ValueError("ESIG: a página não contém todos os pontos solicitados.")
            features.extend(rows)
    return features


def _neighborhood(value):
    if not isinstance(value, str):
        return None, None
    label = re.sub(r"\s+", " ", unicodedata.normalize("NFC", value)).strip()
    key = "".join(c for c in unicodedata.normalize("NFKD", label.casefold())
                  if not unicodedata.combining(c))
    return key or None, label or None


def transform_flood_points(features, engine):
    if engine not in {"spark", "pandas"}:
        raise ValueError("Motor deve ser spark ou pandas.")
    parsed = []
    ids = set()
    for feature in features:
        identifier = _feature_id(feature)
        if type(identifier) is not int or identifier <= 0 or identifier in ids:
            raise ValueError("Bronze ESIG: ID inválido ou duplicado.")
        ids.add(identifier)
        geometry = feature.get("geometry") or {}
        coordinates = geometry.get("coordinates")
        if (geometry.get("type") != "Point" or not isinstance(coordinates, list)
                or len(coordinates) < 2):
            continue
        longitude, latitude = coordinates[:2]
        if any(type(value) not in {int, float} or not math.isfinite(value)
               for value in (longitude, latitude)):
            continue
        key, label = _neighborhood((feature.get("properties") or {}).get("BAIRRO"))
        parsed.append((identifier, key, label, float(latitude), float(longitude)))

    if engine == "spark":
        from pyspark.sql import SparkSession, functions as F

        spark = SparkSession.builder.master(SPARK_MASTER).appName("SmartCity-Alagamentos").getOrCreate()
        try:
            frame = spark.createDataFrame(parsed, "id_externo long, bairro_chave string, bairro string, "
                                                  "latitude double, longitude double")
            valid = frame.where(F.col("latitude").between(-8.25, -7.85)
                                & F.col("longitude").between(-35.10, -34.80))
            points = [tuple(row) for row in valid.collect()]
        finally:
            spark.stop()
    else:
        points = [row for row in parsed if -8.25 <= row[3] <= -7.85 and -35.10 <= row[4] <= -34.80]
    if not points:
        raise ValueError("Nenhum ponto geográfico válido. A publicação anterior foi preservada.")
    return points


def publish_flood_points(points, token, started_at):
    url = require_config("DATABASE_URL", DATABASE_URL)
    with psycopg.connect(url, connect_timeout=10) as conn, conn.cursor() as cursor:
        cursor.execute("SET LOCAL statement_timeout = '60s'")
        cursor.execute("SELECT pg_advisory_xact_lock(2611606, 2)")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS public.smartcity_pontos_alagamento (
                fonte text NOT NULL,
                id_externo bigint NOT NULL,
                bairro_chave text,
                bairro text,
                latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
                longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
                PRIMARY KEY (fonte, id_externo)
            );
            CREATE TABLE IF NOT EXISTS public.smartcity_alagamentos_publicacao (
                fonte text PRIMARY KEY,
                lote text NOT NULL,
                inicio timestamptz NOT NULL,
                publicado_em timestamptz NOT NULL DEFAULT now(),
                pontos integer NOT NULL
            )
        """)
        cursor.execute("SELECT inicio FROM public.smartcity_alagamentos_publicacao WHERE fonte=%s",
                       (SOURCE,))
        previous = cursor.fetchone()
        if previous and previous[0] > started_at:
            raise ValueError("Já existe uma publicação de uma execução mais recente.")
        cursor.executemany("""
            INSERT INTO public.smartcity_pontos_alagamento
                (fonte, id_externo, bairro_chave, bairro, latitude, longitude)
            VALUES (%s,%s,%s,%s,%s,%s)
            ON CONFLICT (fonte, id_externo) DO UPDATE SET
                bairro_chave=EXCLUDED.bairro_chave, bairro=EXCLUDED.bairro,
                latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude
        """, [(SOURCE, *row) for row in points])
        cursor.execute("""
            DELETE FROM public.smartcity_pontos_alagamento
            WHERE fonte=%s AND NOT (id_externo=ANY(%s::bigint[]))
        """, (SOURCE, [row[0] for row in points]))
        cursor.execute("SELECT count(*) FROM public.smartcity_pontos_alagamento WHERE fonte=%s",
                       (SOURCE,))
        if cursor.fetchone()[0] != len(points):
            raise ValueError("A contagem no Neon divergiu da transformação.")
        cursor.execute("""
            INSERT INTO public.smartcity_alagamentos_publicacao (fonte, lote, inicio, pontos)
            VALUES (%s,%s,%s,%s)
            ON CONFLICT (fonte) DO UPDATE SET lote=EXCLUDED.lote, inicio=EXCLUDED.inicio,
                publicado_em=now(), pontos=EXCLUDED.pontos
        """, (SOURCE, token, started_at, len(points)))
