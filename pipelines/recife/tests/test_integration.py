"""Teste opt-in com bancos descartáveis; nunca usa as URLs normais do .env."""
import os
import unittest
from copy import deepcopy
from uuid import uuid4
from unittest.mock import patch

import psycopg
from psycopg import sql
from pymongo import MongoClient

from fixtures import datasets
from src.extract import Extract
from src.load import Load
from src.transform import Transform


MONGO = os.getenv("ETL_TEST_MONGODB_URI")
POSTGRES = os.getenv("ETL_TEST_DATABASE_URL")


@unittest.skipUnless(MONGO and POSTGRES, "Defina ETL_TEST_MONGODB_URI e ETL_TEST_DATABASE_URL de testes")
class TestIntegration(unittest.TestCase):
    def test_bronze_spark_prata_idempotencia_e_rollback(self):
        suffix = uuid4().hex
        db_name = "etl_test_" + suffix
        table_name = "etl_test_" + suffix
        mongo = MongoClient(MONGO, serverSelectionTimeoutMS=10000)
        with patch("src.load.MONGODB_URI", MONGO), patch("src.load.DATABASE_URL", POSTGRES), patch("src.extract.MONGODB_URI", MONGO):
            loader = Load()
            try:
                population, sanitation = datasets()
                # A API pública retorna JSON sem metadados internos da coleta.
                population = [{key: value for key, value in row.items() if key != "data_extracao"} for row in population]
                collections = {"population": population, **sanitation}
                snapshots = {}
                for name, rows in collections.items():
                    snapshots[name] = loader.load_mongo(rows, db_name, name)
                    self.assertEqual(snapshots[name], loader.load_mongo(rows, db_name, name))
                    self.assertEqual(mongo[db_name][name].count_documents({}), 1)
                modified = deepcopy(population)
                modified[1]["V"] = "101"
                modified[-1]["V"] = "101"
                loader.load_mongo(modified, db_name, "population")
                self.assertEqual(mongo[db_name]["population"].count_documents({}), 2)
                extractor = Extract()
                bronze = {name: extractor.extract_collection_from_mongo(db_name, name, snapshot)
                          for name, snapshot in snapshots.items()}
                # A referência original continua legível após chegar uma versão nova.
                self.assertEqual(bronze["population"][1]["V"], "100")
                frame = Transform().transform_recife(bronze["population"], {
                    "total": bronze["total"], "rede_geral": bronze["rede_geral"],
                })
                loader.load_neondb(frame, table_name)
                loader.load_neondb(frame, table_name)
                self.assertEqual(loader.count_neondb(table_name), 4)
                with psycopg.connect(POSTGRES, autocommit=True) as conn:
                    def read():
                        return conn.execute(sql.SQL("SELECT * FROM {} ORDER BY codigo_bairro").format(
                            sql.Identifier("public", table_name))).fetchall()
                    before = read()
                    # Falha no meio da carga: a primeira linha atualizada deve ser revertida.
                    bad = frame.copy(deep=True)
                    bad.loc[0, "populacao"] = 999
                    bad.loc[1, "ano"] = "inválido"
                    with self.assertRaises(ValueError):
                        loader.load_neondb(bad, table_name)
                    self.assertEqual(read(), before)
                with self.assertRaises(ValueError):
                    loader.load_neondb(frame.iloc[:0], table_name)
                self.assertEqual(loader.count_neondb(table_name), 4)
            finally:
                loader.close()
                mongo.drop_database(db_name)
                mongo.close()
                with psycopg.connect(POSTGRES, autocommit=True) as conn:
                    conn.execute(sql.SQL("DROP TABLE IF EXISTS {}").format(sql.Identifier("public", table_name)))
