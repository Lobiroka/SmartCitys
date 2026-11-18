import psycopg
from psycopg.rows import dict_row

from src.config import DATABASE_URL, require_config
from src.data_quality import REGIONS


def query(sql: str, params=()) -> list[dict]:
    with psycopg.connect(require_config("DATABASE_URL", DATABASE_URL), connect_timeout=10) as conn:
        conn.read_only = True
        with conn.cursor(row_factory=dict_row) as cursor:
            cursor.execute("SET LOCAL statement_timeout = '15s'")
            cursor.execute(sql, params, prepare=True)
            return [dict(row) for row in cursor.fetchall()]


def regional_indicators(region: str | None = None) -> list[dict]:
    if region is not None and region not in REGIONS:
        raise ValueError("Região inválida; use os códigos de região do SmartCity.")
    if region is None:
        return query("SELECT * FROM public.smartcity_indicadores_regiao ORDER BY regiao")
    return query("SELECT * FROM public.smartcity_indicadores_regiao WHERE regiao = %s", (region,))


def pipeline_runs() -> list[dict]:
    return query("""SELECT execucao_id, inicio, publicado_em, motor, bairros, ocorrencias, lotes
                    FROM public.smartcity_pipeline_execucoes ORDER BY publicado_em DESC LIMIT 20""")
