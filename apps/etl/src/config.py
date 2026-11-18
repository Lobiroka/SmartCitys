import os
from pathlib import Path

from dotenv import load_dotenv


load_dotenv(Path(__file__).resolve().parent.parent / ".env")

MONGODB_URI = os.getenv("MONGODB_URI")
DATABASE_URL = os.getenv("DATABASE_URL")
SMARTCITY_DATABASE_URL = os.getenv("SMARTCITY_DATABASE_URL")
MONGODB_DATABASE = os.getenv("MONGODB_DATABASE", "IBGE")
TRANSFORM_ENGINE = os.getenv("TRANSFORM_ENGINE", "spark").lower()
SPARK_MASTER = os.getenv("SPARK_MASTER", "local[2]")
PIPELINE_CRON = os.getenv("PIPELINE_CRON", "0 6 * * *")
IBGE_EXPECTED_NEIGHBORHOODS = int(os.getenv("IBGE_EXPECTED_NEIGHBORHOODS", "94"))


def require_config(name: str, value: str | None) -> str:
    if not value:
        raise ValueError(f"A variável {name} não foi definida no .env")
    return value
