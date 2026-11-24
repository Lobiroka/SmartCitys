"""Entrada manual: executa a mesma pipeline Spark orquestrada pelo Prefect."""
from orchestrate_prefect import etl_recife_flow


def main():
    return etl_recife_flow()


if __name__ == "__main__":
    main()
