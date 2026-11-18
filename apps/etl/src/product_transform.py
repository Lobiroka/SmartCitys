from decimal import Decimal, InvalidOperation

from src.config import SPARK_MASTER, TRANSFORM_ENGINE
from src.data_quality import validate_ibge_sources, validate_indicators, validate_occurrences
from src.transform import MISSING_VALUES, Transform


def sidra_rows(data: list[dict], column: str) -> list[dict]:
    rows = []
    for item in data:
        code = str(item.get("D1C", "")).strip()
        if not code.isdigit():
            continue
        raw = str(item.get("V", "")).strip()
        if item.get("V") is None or raw.upper() in MISSING_VALUES:
            value = None
        else:
            try:
                numeric = Decimal(raw)
            except InvalidOperation as exc:
                raise ValueError("IBGE: valor numérico desconhecido.") from exc
            if not numeric.is_finite() or numeric < 0 or numeric != int(numeric):
                raise ValueError("IBGE: contagem inválida.")
            value = int(numeric)
        row = {"codigo_bairro": code, column: value}
        if column == "populacao":
            row["bairro"] = str(item.get("D1N", "")).strip()
        rows.append(row)
    return rows


def transform_product(population, sanitation, occurrences, engine: str = TRANSFORM_ENGINE) -> dict:
    validate_ibge_sources(population, sanitation)
    occurrences = validate_occurrences(occurrences)
    pop = sidra_rows(population, "populacao")
    total = sidra_rows(sanitation["total"], "domicilios_total")
    network = sidra_rows(sanitation["rede_geral"], "domicilios_rede_geral")
    if engine == "spark":
        indicators, occurrences = _spark(pop, total, network, occurrences)
    elif engine == "pandas":
        frame = Transform().transform_recife(population, sanitation)
        indicators = [{key: value for key, value in row.items() if key != "data_extracao"}
                      for row in frame.to_dict(orient="records")]
    else:
        raise ValueError("TRANSFORM_ENGINE deve ser spark ou pandas.")
    validate_indicators(indicators)
    if len(indicators) != len(pop) or len(occurrences) != len({r['id_denuncia'] for r in occurrences}):
        raise ValueError("Perda de registros durante a transformação.")
    return {"ibge": indicators, "ocorrencias": occurrences, "motor": engine}


def _spark(population, total, network, occurrences):
    try:
        from pyspark.sql import SparkSession, functions as F
    except ImportError as exc:
        raise RuntimeError("Instale requirements.txt para Spark ou defina TRANSFORM_ENGINE=pandas.") from exc

    spark = (SparkSession.builder.master(SPARK_MASTER).appName("SmartCity-Bronze-Prata")
             .config("spark.sql.session.timeZone", "UTC")
             .config("spark.sql.shuffle.partitions", "2").getOrCreate())
    try:
        pop = spark.createDataFrame(population, "codigo_bairro string, bairro string, populacao long")
        sanitation = spark.createDataFrame(total, "codigo_bairro string, domicilios_total long")
        sanitation_network = spark.createDataFrame(network, "codigo_bairro string, domicilios_rede_geral long")
        indicators = (pop.join(sanitation, "codigo_bairro", "left")
                      .join(sanitation_network, "codigo_bairro", "left")
                      .withColumn("percentual_rede_esgoto", F.when(
                          F.col("domicilios_total") > 0,
                          F.bround(F.col("domicilios_rede_geral") / F.col("domicilios_total") * 100, 2)))
                      .withColumn("ano", F.lit(2010)))
        source = spark.createDataFrame(occurrences, "id_denuncia long, categoria string, regiao string, "
                                       "status string, prioridade string, data_registro string")
        silver = (source.withColumn("data_registro", F.to_timestamp("data_registro"))
                  .withColumn("dia_registro", F.to_date("data_registro")))
        if silver.filter(F.col("data_registro").isNull()).count():
            raise ValueError("Spark: conversão de data de ocorrência inválida.")
        silver = silver.withColumn("data_registro", F.date_format(
            "data_registro", "yyyy-MM-dd'T'HH:mm:ss.SSSSSSXXX")).drop("dia_registro")
        result = [row.asDict() for row in silver.collect()]
        return [row.asDict() for row in indicators.orderBy("codigo_bairro").collect()], result
    finally:
        spark.stop()
