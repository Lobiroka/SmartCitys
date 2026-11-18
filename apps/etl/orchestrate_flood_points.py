from datetime import datetime, timezone

from prefect import flow, get_run_logger, task

from src.bronze import BronzeStore
from src.config import DATABASE_URL, MONGODB_URI, TRANSFORM_ENGINE, require_config
from src.flood_points import SOURCE, extract_flood_points, publish_flood_points, transform_flood_points


@task(name="Extrair pontos públicos do ESIG", retries=2, retry_delay_seconds=10)
def extract():
    return extract_flood_points()


@task(name="Gravar e reler GeoJSON na bronze", retries=2, retry_delay_seconds=10)
def bronze(features):
    store = BronzeStore()
    try:
        token = store.write(SOURCE, features)
        return token, store.read(token)
    finally:
        store.close()


@task(name="Validar e padronizar pontos da camada")
def transform(features, engine):
    return transform_flood_points(features, engine)


@task(name="Publicar snapshot no Neon", retries=2, retry_delay_seconds=10)
def publish(points, token, started_at):
    publish_flood_points(points, token, started_at)


@flow(name="SmartCity - pontos de alagamento", log_prints=True)
def flood_points_flow(engine: str = TRANSFORM_ENGINE):
    require_config("MONGODB_URI", MONGODB_URI)
    require_config("DATABASE_URL", DATABASE_URL)
    if engine == "spark":
        import importlib.util

        if importlib.util.find_spec("pyspark") is None:
            raise RuntimeError("PySpark ausente. Instale requirements.txt ou use --engine pandas.")
    started_at = datetime.now(timezone.utc)
    token, features = bronze(extract())
    points = transform(features, engine)
    publish(points, token, started_at)
    result = {"lote": token, "bruto": len(features), "publicado": len(points),
              "rejeitado": len(features) - len(points), "motor": engine}
    get_run_logger().info("Carga de alagamentos: %s", result)
    return result
