"""Transformação bronze → prata com operações distribuídas do Apache Spark."""
from datetime import datetime, timezone

import pandas as pd
from pyspark.sql import DataFrame, SparkSession, functions as F, types as T

from src.config import REFERENCE_YEAR, SPARK_MASTER


MISSING_VALUES = ("", "-", "...", "..", "…", "N/A", "NA", "NULL")
COLUMNS = [
    "codigo_bairro", "bairro", "populacao", "domicilios_total",
    "domicilios_rede_geral", "percentual_rede_esgoto", "ano", "data_extracao",
]
RAW_SCHEMA = T.StructType([
    T.StructField("D1C", T.StringType()),
    T.StructField("D1N", T.StringType()),
    T.StructField("V", T.StringType()),
])


def create_spark_session() -> SparkSession:
    """Inicia Spark local por padrão; o master pode ser definido no ambiente."""
    return (
        SparkSession.builder.master(SPARK_MASTER)
        .appName("SmartCity-Recife-Bronze-Prata")
        .config("spark.sql.session.timeZone", "UTC")
        .config("spark.sql.shuffle.partitions", "2")
        .config("spark.ui.enabled", "false")
        .getOrCreate()
    )


class Transform:
    def __init__(self, spark: SparkSession | None = None):
        self.spark = spark

    @staticmethod
    def _normalize(spark: SparkSession, data: list[dict], column: str, population: bool = False) -> DataFrame:
        if not data:
            raise ValueError(f"A fonte não retornou dados para {column}")
        # Apenas projeção de campos; limpeza, tipos e deduplicação ocorrem no Spark.
        rows = [tuple(None if item.get(key) is None else str(item[key])
                      for key in ("D1C", "D1N", "V")) for item in data]
        raw = spark.createDataFrame(rows, RAW_SCHEMA).withColumn("codigo_bairro", F.trim("D1C"))
        raw = raw.filter(F.col("codigo_bairro").rlike(r"^\d+$"))
        raw = raw.withColumn("valor", F.trim("V"))
        raw = raw.withColumn(column, F.col("valor").try_cast("long"))
        missing = F.col("valor").isNull() | F.upper("valor").isin(*MISSING_VALUES)
        invalid = (~missing & F.col(column).isNull()) | (F.col(column) < 0) | (F.col(column) > 2147483647)
        if raw.filter(invalid).limit(1).count():
            raise ValueError(f"Valor inválido na fonte de {column}")
        columns = ["codigo_bairro", column]
        if population:
            raw = raw.withColumn("bairro", F.trim("D1N"))
            if raw.filter(F.col("bairro").isNull() | (F.col("bairro") == "")).limit(1).count():
                raise ValueError("Bairro sem nome")
            columns.insert(1, "bairro")
        normalized = raw.select(*columns).dropDuplicates().cache()
        if not normalized.limit(1).count():
            normalized.unpersist()
            raise ValueError(f"Nenhum bairro válido em {column}")
        if normalized.groupBy("codigo_bairro").count().filter(F.col("count") > 1).limit(1).count():
            normalized.unpersist()
            raise ValueError(f"Registros conflitantes por bairro em {column}")
        return normalized

    def transform_recife(self, populacao: list[dict], saneamento: dict) -> pd.DataFrame:
        """Limpa, integra e calcula cobertura no Spark; converte só a saída para carga SQL."""
        owns_session = self.spark is None
        spark = self.spark or create_spark_session()
        frames = []
        try:
            population = self._normalize(spark, populacao, "populacao", population=True)
            frames.append(population)
            total = self._normalize(spark, saneamento["total"], "domicilios_total")
            frames.append(total)
            network = self._normalize(spark, saneamento["rede_geral"], "domicilios_rede_geral")
            frames.append(network)
            # Impede publicar uma carga incompleta ou de outro conjunto de bairros.
            for source in (total, network):
                if (population.select("codigo_bairro").subtract(source.select("codigo_bairro")).limit(1).count()
                    or source.select("codigo_bairro").subtract(population.select("codigo_bairro")).limit(1).count()):
                    raise ValueError("Conjuntos de bairros divergentes entre as fontes")
            result = population.join(total, "codigo_bairro").join(network, "codigo_bairro")
            if result.filter(F.col("domicilios_rede_geral") > F.col("domicilios_total")).limit(1).count():
                raise ValueError("Domicílios ligados à rede excedem o total")
            result = result.withColumn(
                "percentual_rede_esgoto",
                F.when(F.col("domicilios_total") > 0,
                       F.round(F.col("domicilios_rede_geral") / F.col("domicilios_total") * 100, 2)),
            ).withColumn("ano", F.lit(REFERENCE_YEAR))
            # Preserva o instante da aquisição da versão bronze, inclusive nas reexecuções.
            dates = [pd.to_datetime(item.get("data_extracao"), utc=True, errors="coerce") for item in populacao]
            dates = [date for date in dates if not pd.isna(date)]
            acquired_at = max(dates).to_pydatetime() if dates else datetime.now(timezone.utc)
            result = result.withColumn("data_extracao", F.lit(acquired_at))
            # Serializa no fuso da sessão (UTC), evitando que collect use o fuso
            # local do processo Python ao converter TimestampType.
            result = result.withColumn("data_extracao", F.date_format(
                "data_extracao", "yyyy-MM-dd'T'HH:mm:ss.SSSSSS'Z'"))
            # O recorte de 94 bairros cabe no driver. As operações acima são Spark SQL.
            records = [row.asDict() for row in result.select(*COLUMNS).orderBy("bairro", "codigo_bairro").collect()]
            frame = pd.DataFrame(records, columns=COLUMNS)
            frame["data_extracao"] = pd.to_datetime(frame["data_extracao"], utc=True)
            frame = frame.astype(object)
            return frame.where(pd.notna(frame), None)
        finally:
            for frame in frames:
                frame.unpersist()
            if owns_session:
                spark.stop()
