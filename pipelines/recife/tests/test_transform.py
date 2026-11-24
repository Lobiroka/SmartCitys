import unittest
from copy import deepcopy

from fixtures import ACQUIRED_AT, datasets
from src.transform import Transform, create_spark_session


class TestSparkTransform(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.spark = create_spark_session()
        cls.spark.sparkContext.setLogLevel("ERROR")
        cls.transformer = Transform(cls.spark)

    @classmethod
    def tearDownClass(cls):
        cls.spark.stop()

    def test_limpeza_join_tipos_cobertura_nulos_zero_e_data(self):
        population, sanitation = datasets()
        frame = self.transformer.transform_recife(population, sanitation)
        rows = frame.set_index("codigo_bairro").to_dict(orient="index")
        self.assertEqual(len(rows), 4)
        self.assertEqual(rows["001"]["populacao"], 100)
        self.assertEqual(rows["001"]["percentual_rede_esgoto"], 50)
        self.assertEqual(rows["004"]["percentual_rede_esgoto"], 33.33)
        self.assertEqual(rows["002"]["populacao"], 0)
        self.assertIsNone(rows["002"]["percentual_rede_esgoto"])
        self.assertIsNone(rows["003"]["populacao"])
        self.assertIsNone(rows["003"]["domicilios_total"])
        self.assertEqual(rows["001"]["ano"], 2010)
        self.assertEqual(rows["001"]["data_extracao"], ACQUIRED_AT)

    def test_rejeita_duplicatas_conflitantes_e_valores_invalidos(self):
        population, sanitation = datasets()
        invalid = deepcopy(population)
        invalid.append({"D1C": "001", "D1N": "Alpha", "V": "101"})
        with self.assertRaisesRegex(ValueError, "conflitantes"):
            self.transformer.transform_recife(invalid, sanitation)
        invalid = deepcopy(population)
        invalid[1]["V"] = "não numérico"
        with self.assertRaisesRegex(ValueError, "Valor inválido"):
            self.transformer.transform_recife(invalid, sanitation)
        with self.assertRaises(ValueError):
            self.transformer.transform_recife([population[0]], sanitation)

    def test_rejeita_fontes_incompletas_e_cobertura_acima_de_cem(self):
        population, sanitation = datasets()
        incomplete = deepcopy(sanitation)
        incomplete["total"] = incomplete["total"][:-1]
        with self.assertRaisesRegex(ValueError, "divergentes"):
            self.transformer.transform_recife(population, incomplete)
        invalid = deepcopy(sanitation)
        invalid["rede_geral"][1]["V"] = "11"
        with self.assertRaisesRegex(ValueError, "excedem"):
            self.transformer.transform_recife(population, invalid)

    def test_limites_sao_ligados_ao_codigo_ibge_e_validam_completude(self):
        import pandas as pd
        from src.geography import transform_boundaries
        geometry = {'type': 'Polygon', 'coordinates': [[[-35,-9],[-34,-9],[-34,-8],[-35,-9]]]}
        features = [{'type': 'Feature', 'properties': {'EBAIRRNOMEOF': 'Cohab - Ibura de Cima'}, 'geometry': geometry}]
        indicators = pd.DataFrame([{'codigo_bairro': '2611606001', 'bairro': 'Cohab - Recife - PE'}])
        result = transform_boundaries(self.spark, features, indicators)
        self.assertEqual(result[0]['codigo_bairro'], '2611606001')
        self.assertIn('Polygon', result[0]['geometria'])
        with self.assertRaisesRegex(ValueError, 'não correspondem'):
            transform_boundaries(self.spark, features, pd.DataFrame([{'codigo_bairro': '2', 'bairro': 'Outro'}]))

    def test_limites_rejeitam_geometria_projetada_ou_incompleta(self):
        from src.geography import validate_geometry
        for geometry in [
            {'type': 'Point', 'coordinates': [0,0]},
            {'type': 'Polygon', 'coordinates': [[[10000,90000],[10001,90000],[10001,90001],[10000,90000]]]},
            {'type': 'Polygon', 'coordinates': [[[0,0],[1,0],[1,1]]]},
        ]:
            with self.assertRaises(ValueError):
                validate_geometry(geometry)
