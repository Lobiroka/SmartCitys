import unittest
from unittest.mock import MagicMock, patch

from src.load import Load
from src.extract import Extract
import serve_etl
import orchestrate_prefect as pipeline


class TestPipeline(unittest.TestCase):
    def test_bronze_identificador_estavel_e_upsert_sem_apagar_legado(self):
        loader = Load.__new__(Load)
        loader.client = MagicMock()
        data = [{"D1C": "001", "D1N": "Alpha", "V": "10"}]
        first = loader.load_mongo(data, "test", "population")
        second = loader.load_mongo(data, "test", "population")
        self.assertEqual(first, second)
        modified = loader.load_mongo([{**data[0], "V": "11"}], "test", "population")
        self.assertNotEqual(first, modified)
        collection = loader.client["test"]["population"]
        args, kwargs = collection.update_one.call_args_list[0]
        self.assertEqual(args[0], {"_id": first})
        self.assertEqual(args[1]["$setOnInsert"]["registros"], data)
        self.assertEqual(kwargs, {"upsert": True})
        collection.insert_many.assert_not_called()
        collection.delete_many.assert_not_called()
        with self.assertRaises(ValueError):
            loader.load_mongo([], "test", "population")

    @patch("src.extract.MongoClient")
    @patch("src.extract.MONGODB_URI", "mongodb://test")
    def test_leitura_do_snapshot_exato_sem_recorrer_a_outra_carga(self, client):
        collection = client.return_value["test"]["population"]
        collection.find_one.return_value = {
            "tipo": "bronze_snapshot", "data_extracao": "date",
            "registros": [{"D1C": "001", "V": "10"}],
        }
        self.assertEqual(Extract().extract_collection_from_mongo("test", "population", "hash"),
                         [{"D1C": "001", "V": "10", "data_extracao": "date"}])
        self.assertEqual(collection.find_one.call_args.args[0], {"_id": "hash"})
        collection.find_one.return_value = None
        with self.assertRaisesRegex(ValueError, "não encontrado"):
            Extract().extract_collection_from_mongo("test", "population", "missing")
        collection.find.assert_not_called()
        self.assertEqual(client.return_value.close.call_count, 2)

    @patch.object(pipeline, "get_run_logger")
    @patch.object(pipeline, "Extract")
    def test_prefect_propaga_referencias_da_mesma_carga(self, extractor, _logger):
        snapshots = {"population": "p", "total": "t", "rede_geral": "r"}
        pipeline.read_mongodb.fn(snapshots)
        self.assertEqual([call.args[2] for call in extractor.return_value.extract_collection_from_mongo.call_args_list],
                         ["p", "t", "r"])

    @patch.object(serve_etl.etl_recife_flow, "serve")
    def test_agendamento_diario_fuso_e_limite_de_concorrencia(self, serve):
        serve_etl.main()
        options = serve.call_args.kwargs
        self.assertEqual(options["schedule"].cron, "0 3 * * *")
        self.assertEqual(options["schedule"].timezone, "America/Recife")
        self.assertEqual(options["global_limit"], 1)
        self.assertEqual(options["limit"], 1)
