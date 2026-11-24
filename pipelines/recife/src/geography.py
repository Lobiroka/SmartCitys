"""Geometrias públicas auxiliares para cruzar coordenadas e indicadores."""
import json
import math
import re
import unicodedata

from pyspark.sql import functions as F

BOUNDARIES_URL = (
    'https://esigportal2.recife.pe.gov.br/arcgis/rest/services/'
    'Planejamento/BASES_LIMITESOFICIAIS_LOGRADOUROS/FeatureServer/5/query'
)


def name_key(value: str) -> str:
    text = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode().lower()
    key = re.sub('[^a-z0-9]', '', text)
    # O nome oficial municipal contém o complemento; o SIDRA 2010 usa "Cohab".
    return {'cohabiburadecima': 'cohab'}.get(key, key)


def validate_geometry(geometry: dict) -> None:
    if geometry.get('type') not in ('Polygon', 'MultiPolygon'):
        raise ValueError('Tipo de geometria de bairro inválido')
    polygons = [geometry.get('coordinates')] if geometry['type'] == 'Polygon' else geometry.get('coordinates')
    if not polygons:
        raise ValueError('Bairro sem polígono')
    for polygon in polygons:
        if not polygon:
            raise ValueError('Polígono vazio')
        for ring in polygon:
            if len(ring) < 4 or ring[0] != ring[-1]:
                raise ValueError('Anel de bairro incompleto')
            for point in ring:
                if (len(point) < 2 or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in point[:2])
                    or not -180 <= point[0] <= 180 or not -90 <= point[1] <= 90):
                    raise ValueError('Coordenadas fora de WGS84')


def transform_boundaries(spark, features: list[dict], indicators) -> list[dict]:
    """Valida WGS84 e faz o join dos nomes oficiais com os códigos SIDRA no Spark."""
    rows = []
    for feature in features:
        validate_geometry(feature['geometry'])
        name = feature['properties'].get('EBAIRRNOMEOF')
        if not isinstance(name, str) or not name.strip():
            raise ValueError('Limite sem nome oficial de bairro')
        rows.append((name_key(name), json.dumps(feature['geometry'], separators=(',', ':'))))
    if not rows:
        raise ValueError('Nenhum limite de bairro recebido')
    boundaries = spark.createDataFrame(rows, 'chave string, geometria string')
    mapping = spark.createDataFrame([
        (name_key(row['bairro'].removesuffix(' - Recife - PE')), row['codigo_bairro'])
        for row in indicators.to_dict(orient='records')
    ], 'chave string, codigo_bairro string')
    for frame in (boundaries, mapping):
        if frame.groupBy('chave').count().filter(F.col('count') != 1).limit(1).count():
            raise ValueError('Nomes de bairros ambíguos na integração geográfica')
    if (boundaries.select('chave').subtract(mapping.select('chave')).limit(1).count()
        or mapping.select('chave').subtract(boundaries.select('chave')).limit(1).count()):
        raise ValueError('Limites municipais e bairros do IBGE não correspondem')
    return [row.asDict() for row in boundaries.join(mapping, 'chave').select('codigo_bairro', 'geometria').collect()]
