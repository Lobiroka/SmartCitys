import psycopg
from psycopg.rows import dict_row

from src.config import SMARTCITY_DATABASE_URL, require_config


def extract_occurrences() -> list[dict]:
    url = require_config("SMARTCITY_DATABASE_URL", SMARTCITY_DATABASE_URL)
    with psycopg.connect(url, connect_timeout=10) as conn:
        conn.read_only = True
        with conn.cursor(row_factory=dict_row) as cursor:
            cursor.execute("SET LOCAL statement_timeout = '60s'")
            cursor.execute("""
                SELECT id_denuncia, categoria::text, regiao::text, status::text,
                       prioridade::text, data_registro
                FROM demand.denuncias ORDER BY id_denuncia
            """)
            return [dict(row) for row in cursor.fetchall()]
