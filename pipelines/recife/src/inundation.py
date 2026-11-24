"""API SGB → bronze → transformação Spark → prata de suscetibilidade à inundação."""
import json
from datetime import datetime, timezone

import psycopg
import requests
from psycopg.types.json import Jsonb
from pyspark.sql import functions as F

from src.geography import validate_geometry

SGB_QUERY_URL = ('https://geoportal.sgb.gov.br/server/rest/services/'
                 'gestaoterritorial/inundacao/FeatureServer/0/query')
SGB_FILTER = "uf='PE' AND municipio='RECIFE'"
SGB_COLLECTION = 'RECIFE_INUNDACAO_SGB'


def extract_inundation() -> list[dict]:
    """Fixa os IDs da coleta e confere todas as páginas antes de publicar o snapshot."""
    def query(**params):
        response = requests.get(SGB_QUERY_URL, params={'where': SGB_FILTER, **params}, timeout=60)
        response.raise_for_status()
        payload = response.json()
        if 'error' in payload:
            raise ValueError('API SGB indisponível ou consulta recusada')
        return payload

    ids = query(returnIdsOnly='true', f='json').get('objectIds')
    if not ids or len(ids) != len(set(ids)):
        raise ValueError('API SGB sem identificadores válidos')
    features = []
    ids = sorted(ids)
    for offset in range(0, len(ids), 200):
        payload = query(
            objectIds=','.join(map(str, ids[offset:offset + 200])),
            outFields='objectid,uf,municipio,classe,ano,fonte,processo',
            outSR=4326, returnZ='false', returnM='false', geometryPrecision=6,
            orderByFields='objectid', f='geojson',
        )
        if payload.get('type') != 'FeatureCollection' or payload.get('exceededTransferLimit'):
            raise ValueError('Página SGB inválida ou truncada')
        features.extend(payload.get('features', []))
    found = [item.get('properties', {}).get('objectid') for item in features]
    if len(found) != len(ids) or set(found) != set(ids):
        raise ValueError('Coleta SGB incompleta ou com identificadores duplicados')
    return features


def transform_inundation(spark, features: list[dict]) -> list[dict]:
    """Valida geometria WGS84, preserva buracos e normaliza/deduplica atributos no Spark."""
    rows = []
    for item in features:
        props = item['properties']
        geometry = item['geometry']
        validate_geometry(geometry)
        identifier = props.get('objectid')
        year = props.get('ano')
        if isinstance(identifier, bool) or not isinstance(identifier, int) or identifier <= 0:
            raise ValueError('Identificador SGB inválido')
        if year is not None and (isinstance(year, bool) or not isinstance(year, int)
                                 or not 1900 <= year <= datetime.now(timezone.utc).year):
            raise ValueError('Ano de referência SGB inválido')
        polygons = [geometry['coordinates']] if geometry['type'] == 'Polygon' else geometry['coordinates']
        points = [point for polygon in polygons for ring in polygon for point in ring]
        bounds = [min(p[0] for p in points), min(p[1] for p in points),
                  max(p[0] for p in points), max(p[1] for p in points)]
        bounds = [float(value) for value in bounds]
        acquired_at = item.get('data_extracao')
        if not isinstance(acquired_at, datetime) or acquired_at.tzinfo is None:
            raise ValueError('Snapshot SGB sem data de extração UTC')
        rows.append((identifier, props.get('uf'), props.get('municipio'), props.get('classe'),
                     year, props.get('fonte'), json.dumps(geometry, separators=(',', ':')),
                     bounds, acquired_at.isoformat()))
    if not rows:
        raise ValueError('Carga SGB vazia: prata anterior preservada')
    frame = spark.createDataFrame(rows, '''id long, uf string, municipio string, classe string,
        ano int, descricao_fonte string, geometria string, bbox array<double>, data_extracao string''')
    frame = frame.withColumn('classe', F.initcap(F.trim('classe'))).withColumn('municipio', F.upper(F.trim('municipio')))
    if frame.filter((F.col('uf') != 'PE') | (F.col('municipio') != 'RECIFE')
                    | F.col('classe').isNull() | ~F.col('classe').isin('Baixa', 'Média', 'Alta')
                    | F.col('uf').isNull() | F.col('municipio').isNull()).limit(1).count():
        raise ValueError('Classe ou município SGB inválido')
    frame = frame.dropDuplicates()
    if frame.groupBy('id').count().filter(F.col('count') > 1).limit(1).count():
        raise ValueError('Identificadores SGB com conteúdo conflitante')
    result = [row.asDict() for row in frame.drop('uf', 'municipio').orderBy('id').collect()]
    for row in result:
        row['geometria'] = json.loads(row['geometria'])
        row['data_extracao'] = datetime.fromisoformat(row['data_extracao'])
    return result


def load_inundation(database_url: str, rows: list[dict]) -> None:
    if not rows or len({row['id'] for row in rows}) != len(rows):
        raise ValueError('Carga SGB vazia ou com duplicatas')
    with psycopg.connect(database_url, connect_timeout=10) as conn:
        conn.execute("SET LOCAL lock_timeout = '3s'")
        conn.execute("SET LOCAL statement_timeout = '15s'")
        # Evita duas publicações concorrentes da camada, inclusive em execuções manuais.
        conn.execute("SELECT pg_advisory_xact_lock(2611606, 58)")
        conn.execute('''CREATE TABLE IF NOT EXISTS public.recife_inundacao_sgb (
            id BIGINT PRIMARY KEY,
            classe TEXT NOT NULL CHECK (classe IN ('Baixa', 'Média', 'Alta')),
            ano INTEGER, descricao_fonte TEXT, geometria JSONB NOT NULL,
            bbox DOUBLE PRECISION[] NOT NULL CHECK (array_length(bbox, 1) = 4),
            fonte TEXT NOT NULL, data_extracao TIMESTAMPTZ NOT NULL
        )''')
        with conn.cursor() as cursor:
            cursor.executemany('''INSERT INTO public.recife_inundacao_sgb
                (id, classe, ano, descricao_fonte, geometria, bbox, fonte, data_extracao)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                ON CONFLICT (id) DO UPDATE SET classe=EXCLUDED.classe, ano=EXCLUDED.ano,
                descricao_fonte=EXCLUDED.descricao_fonte, geometria=EXCLUDED.geometria,
                bbox=EXCLUDED.bbox, fonte=EXCLUDED.fonte, data_extracao=EXCLUDED.data_extracao''', [
                    (row['id'], row['classe'], row['ano'], row['descricao_fonte'], Jsonb(row['geometria']),
                     row['bbox'], SGB_QUERY_URL, row['data_extracao']) for row in rows
                ])
        # Sincroniza remoções somente após uma coleta completa e uma transformação válidas.
        conn.execute('DELETE FROM public.recife_inundacao_sgb WHERE NOT (id = ANY(%s))',
                     ([row['id'] for row in rows],))
        count = conn.execute('SELECT COUNT(*) FROM public.recife_inundacao_sgb').fetchone()[0]
        if count != len(rows):
            raise ValueError('Contagem SGB divergente: transação revertida')
