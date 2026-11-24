import os
from pathlib import Path

from dotenv import load_dotenv


load_dotenv(Path(__file__).resolve().parent.parent / ".env")

MONGODB_URI = os.getenv("MONGODB_URI")
DATABASE_URL = os.getenv("DATABASE_URL")
DATABASE_URL_READONLY = os.getenv("DATABASE_URL_READONLY") or DATABASE_URL
SPARK_MASTER = os.getenv("SPARK_MASTER", "local[2]")
ETL_CRON = os.getenv("ETL_CRON", "0 3 * * *")
ETL_TIMEZONE = os.getenv("ETL_TIMEZONE", "America/Recife")
REFERENCE_YEAR = 2010


def require_config(name: str, value: str | None) -> str:
    if not value:
        raise ValueError(f"A variável {name} não foi definida no .env")
    return value
