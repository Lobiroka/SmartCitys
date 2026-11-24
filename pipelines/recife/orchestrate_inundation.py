"""Subflow SGB também executável sem repetir a coleta do IBGE."""
from prefect import flow, task
from src.config import DATABASE_URL, MONGODB_URI, require_config
from src.extract import Extract
from src.load import Load
from src.transform import create_spark_session
from src.inundation import (SGB_COLLECTION, SGB_QUERY_URL, extract_inundation,
                            transform_inundation, load_inundation)


@task(name='Extrair áreas de inundação do SGB', retries=3, retry_delay_seconds=10)
def extract_sgb():
    return extract_inundation()


@task(name='Gravar snapshot SGB bronze', retries=3, retry_delay_seconds=10)
def bronze_sgb(features):
    loader = Load()
    try:
        return loader.load_mongo(features, 'IBGE', SGB_COLLECTION, source=SGB_QUERY_URL)
    finally:
        loader.close()


@task(name='Transformar snapshot SGB com Spark', retries=1, retry_delay_seconds=5)
def transform_sgb(snapshot):
    features = Extract().extract_collection_from_mongo('IBGE', SGB_COLLECTION, snapshot)
    spark = create_spark_session()
    try:
        return transform_inundation(spark, features)
    finally:
        spark.stop()


@task(name='Publicar áreas SGB no Neon', retries=3, retry_delay_seconds=10)
def silver_sgb(rows):
    load_inundation(require_config('DATABASE_URL', DATABASE_URL), rows)
    return len(rows)


@flow(name='ETL SGB Recife', log_prints=True, persist_result=False)
def etl_inundation_flow():
    require_config('MONGODB_URI', MONGODB_URI)
    require_config('DATABASE_URL', DATABASE_URL)
    return silver_sgb(transform_sgb(bronze_sgb(extract_sgb())))


if __name__ == '__main__':
    etl_inundation_flow()
