from src.config import DATABASE_URL, MONGODB_URI, require_config

from prefect import flow, task, get_run_logger

from src.extract import Extract
from src.load import Load
from src.transform import Transform, create_spark_session
from src.geography import transform_boundaries


DB_NAME = "IBGE"
COLLECTION_POPULACAO = "RECIFE_POPULACAO_BAIRROS"
COLLECTION_SANEAMENTO_TOTAL = "RECIFE_SANEAMENTO_TOTAL"
COLLECTION_SANEAMENTO_REDE = "RECIFE_SANEAMENTO_REDE_GERAL"
COLLECTION_LIMITES = "RECIFE_BAIRROS_LIMITES"
NEON_TABLE = "recife_populacao_saneamento"


@task(name="Extrair população do IBGE", retries=3, retry_delay_seconds=10)
def extract_population() -> list[dict]:
    logger = get_run_logger()
    extractor = Extract()
    data = extractor.bairros_recife("recife")
    logger.info("%s registros de população recebidos da API.", sum(
        1 for item in data if str(item.get("D1C", "")).strip().isdigit()
    ))
    return data


@task(name="Extrair saneamento do IBGE", retries=3, retry_delay_seconds=10)
def extract_sanitation() -> dict[str, list[dict]]:
    logger = get_run_logger()
    extractor = Extract()
    data = extractor.saneamento_recife("recife")
    logger.info(
        "Saneamento extraído: total=%s, rede geral=%s registros.",
        sum(1 for item in data["total"] if str(item.get("D1C", "")).strip().isdigit()),
        sum(1 for item in data["rede_geral"] if str(item.get("D1C", "")).strip().isdigit()),
    )
    return data


@task(name="Extrair limites oficiais dos bairros", retries=3, retry_delay_seconds=10)
def extract_boundaries() -> list[dict]:
    return Extract().limites_bairros_recife()


@task(name="Carregar dados brutos no MongoDB", retries=3, retry_delay_seconds=10)
def load_raw_data(population: list[dict], sanitation: dict[str, list[dict]], boundaries: list[dict] | None = None) -> dict[str, str]:
    logger = get_run_logger()
    loader = Load()
    try:
        snapshots = {
            "population": loader.load_mongo(population, DB_NAME, COLLECTION_POPULACAO),
            "total": loader.load_mongo(sanitation["total"], DB_NAME, COLLECTION_SANEAMENTO_TOTAL),
            "rede_geral": loader.load_mongo(sanitation["rede_geral"], DB_NAME, COLLECTION_SANEAMENTO_REDE),
        }
        if boundaries is not None:
            snapshots["boundaries"] = loader.load_mongo(boundaries, DB_NAME, COLLECTION_LIMITES)
        logger.info("Dados brutos armazenados no MongoDB Atlas.")
    finally:
        loader.close()
    return snapshots


@task(name="Ler dados brutos do MongoDB", retries=3, retry_delay_seconds=10)
def read_mongodb(snapshots: dict[str, str]) -> dict:
    logger = get_run_logger()
    extractor = Extract()
    population = extractor.extract_collection_from_mongo(
        DB_NAME, COLLECTION_POPULACAO, snapshots["population"]
    )
    sanitation_total = extractor.extract_collection_from_mongo(
        DB_NAME, COLLECTION_SANEAMENTO_TOTAL, snapshots["total"]
    )
    sanitation_network = extractor.extract_collection_from_mongo(
        DB_NAME, COLLECTION_SANEAMENTO_REDE, snapshots["rede_geral"]
    )

    logger.info(
        "Dados lidos do MongoDB: população=%s, saneamento total=%s, rede geral=%s.",
        len(population), len(sanitation_total), len(sanitation_network)
    )
    boundaries = extractor.extract_collection_from_mongo(
        DB_NAME, COLLECTION_LIMITES, snapshots["boundaries"]
    ) if "boundaries" in snapshots else None
    return {
        "boundaries": boundaries,
        "population": population,
        "sanitation": {
            "total": sanitation_total,
            "rede_geral": sanitation_network,
        },
    }


@task(name="Transformar e integrar dados com Spark", retries=1, retry_delay_seconds=5)
def transform_data(data: dict):
    logger = get_run_logger()
    spark = create_spark_session()
    try:
        dataframe = Transform(spark).transform_recife(data["population"], data["sanitation"])
        boundaries = transform_boundaries(spark, data["boundaries"], dataframe) if data.get("boundaries") is not None else None
        if boundaries is not None:
            acquired_at = max(item["data_extracao"] for item in data["boundaries"])
            for boundary in boundaries:
                boundary["data_extracao"] = acquired_at
    finally:
        spark.stop()
    bronze_population_count = len({
        str(item.get("D1C", "")).strip() for item in data["population"]
        if str(item.get("D1C", "")).strip().isdigit()
    })
    if len(dataframe) != bronze_population_count:
        raise RuntimeError(
            f"Contagem divergente: bronze={bronze_population_count}, "
            f"final={len(dataframe)}"
        )
    logger.info("%s bairros preparados para carga no NeonDB.", len(dataframe))
    return {"indicators": dataframe.to_dict(orient="records"), "boundaries": boundaries}


@task(name="Carregar dados tratados no NeonDB", retries=3, retry_delay_seconds=10)
def load_neondb(data: dict) -> int:
    import pandas as pd

    logger = get_run_logger()
    records = data["indicators"]
    dataframe = pd.DataFrame(records)
    loader = Load()
    try:
        loader.load_neondb(dataframe, NEON_TABLE, data["boundaries"])
        final_count = loader.count_neondb(NEON_TABLE)
        if final_count != len(records):
            raise RuntimeError(
                f"Contagem divergente após a carga: registros da carga={len(records)}, "
                f"tabela final={final_count}"
            )
    finally:
        loader.close()
    logger.info("%s bairros existentes na tabela final do NeonDB.", final_count)
    return final_count


@flow(name="ETL Smart City Recife", log_prints=True, persist_result=False)
def etl_recife_flow():
    require_config("MONGODB_URI", MONGODB_URI)
    require_config("DATABASE_URL", DATABASE_URL)
    population = extract_population()
    sanitation = extract_sanitation()
    boundaries = extract_boundaries()
    raw_loaded = load_raw_data(population, sanitation, boundaries)
    mongo_data = read_mongodb(raw_loaded)
    transformed_records = transform_data(mongo_data)
    total = load_neondb(transformed_records)
    from orchestrate_inundation import etl_inundation_flow
    etl_inundation_flow()
    return total


if __name__ == "__main__":
    etl_recife_flow()
