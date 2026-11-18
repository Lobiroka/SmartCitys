"""IBGE + SmartCity → bronze MongoDB → Spark → prata/ouro Neon."""

import argparse
from datetime import datetime, timezone
from uuid import uuid4

from prefect import flow, get_run_logger, task
from prefect.client.schemas.schedules import CronSchedule

from orchestrate_flood_points import flood_points_flow
from src.bronze import BronzeStore
from src.config import (DATABASE_URL, IBGE_EXPECTED_NEIGHBORHOODS, MONGODB_URI, PIPELINE_CRON,
                        SMARTCITY_DATABASE_URL, TRANSFORM_ENGINE, require_config)
from src.extract import Extract
from src.data_quality import validate_ibge_sources
from src.product_store import publish_product
from src.product_transform import transform_product
from src.smartcity_source import extract_occurrences


@task(name="Extrair API pública IBGE", retries=3, retry_delay_seconds=10)
def extract_ibge() -> dict:
    extractor = Extract()
    sanitation = extractor.saneamento_recife()
    return {"populacao": extractor.bairros_recife(), "saneamento_total": sanitation["total"],
            "saneamento_rede": sanitation["rede_geral"]}


@task(name="Extrair ocorrências SmartCity (somente leitura)", retries=3, retry_delay_seconds=10)
def extract_smartcity() -> list[dict]:
    return extract_occurrences()


@task(name="Gravar snapshots idempotentes na bronze MongoDB", retries=3, retry_delay_seconds=10)
def write_bronze(ibge: dict, occurrences: list[dict]) -> dict:
    store = BronzeStore()
    try:
        return {name: store.write(name, rows)
                for name, rows in {**ibge, "ocorrencias": occurrences}.items()}
    finally:
        store.close()


@task(name="Reler lotes exatos da bronze e conferir integridade", retries=3, retry_delay_seconds=10)
def read_bronze(tokens: dict) -> dict:
    store = BronzeStore()
    try:
        return {name: store.read(token) for name, token in tokens.items()}
    finally:
        store.close()


@task(name="Validar contratos e transformar bronze em prata")
def transform_silver(bronze: dict, engine: str) -> dict:
    sanitation = {"total": bronze["saneamento_total"], "rede_geral": bronze["saneamento_rede"]}
    validate_ibge_sources(bronze["populacao"], sanitation)
    count = sum(str(row.get("D1C", "")).strip().isdigit() for row in bronze["populacao"])
    if count != IBGE_EXPECTED_NEIGHBORHOODS:
        raise ValueError(f"IBGE: esperados {IBGE_EXPECTED_NEIGHBORHOODS} bairros, recebidos {count}.")
    return transform_product(bronze["populacao"],
                             sanitation,
                             bronze["ocorrencias"], engine)


@task(name="Publicar prata, ouro e auditoria no Neon", retries=3, retry_delay_seconds=10)
def publish_neon(silver: dict, run: dict) -> dict:
    return publish_product(silver, run)


@flow(name="SmartCity — IBGE e ocorrências", log_prints=True)
def etl_recife_flow(engine: str = TRANSFORM_ENGINE):
    for name, value in (("MONGODB_URI", MONGODB_URI), ("DATABASE_URL", DATABASE_URL),
                        ("SMARTCITY_DATABASE_URL", SMARTCITY_DATABASE_URL)):
        require_config(name, value)
    if engine not in {"spark", "pandas"}:
        raise ValueError("Motor deve ser spark ou pandas.")
    if engine == "spark":
        import importlib.util
        if importlib.util.find_spec("pyspark") is None:
            raise RuntimeError("PySpark ausente. Instale requirements.txt ou use --engine pandas.")
    run = {"execucao_id": str(uuid4()), "inicio": datetime.now(timezone.utc).isoformat()}
    ibge = extract_ibge()
    occurrences = extract_smartcity()
    tokens = write_bronze(ibge, occurrences)
    run["lotes"] = tokens
    bronze = read_bronze(tokens)
    silver = transform_silver(bronze, engine)
    result = publish_neon(silver, run)
    get_run_logger().info("Publicação conferida: %s", result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--engine", choices=("spark", "pandas"), default=TRANSFORM_ENGINE)
    parser.add_argument("--dataset", choices=("integrado", "alagamentos"), default="integrado")
    parser.add_argument("--serve", action="store_true", help="Servir o agendamento no Prefect")
    args = parser.parse_args()
    selected_flow = flood_points_flow if args.dataset == "alagamentos" else etl_recife_flow
    if args.serve:
        selected_flow.serve(
            name="smartcity-alagamentos" if args.dataset == "alagamentos" else "smartcity-diario",
            schedule=CronSchedule(cron=PIPELINE_CRON, timezone="America/Recife"),
            parameters={"engine": args.engine}, global_limit=1,
            pause_on_shutdown=False,
        )
    else:
        selected_flow(engine=args.engine)


if __name__ == "__main__":
    main()
