"""Registra o agendamento e mantém um runner Prefect disponível."""
from src.config import ETL_CRON, ETL_TIMEZONE

from prefect.schedules import Cron

from orchestrate_prefect import etl_recife_flow


def main() -> None:
    etl_recife_flow.serve(
        name="recife-diario",
        schedule=Cron(ETL_CRON, timezone=ETL_TIMEZONE),
        limit=1,
        global_limit=1,
        pause_on_shutdown=True,
        tags=["smartcity", "bronze", "prata", "spark"],
    )


if __name__ == "__main__":
    main()
