import unittest
from copy import deepcopy
from datetime import datetime, timezone
from unittest.mock import Mock, patch

from src.inundation import extract_inundation, transform_inundation
from src.transform import create_spark_session


def feature(identifier=1):
    return {'type': 'Feature', 'properties': {'objectid': identifier, 'uf': 'PE',
            'municipio': 'Recife', 'classe': ' média ', 'ano': 2014, 'fonte': 'SGB'},
            'geometry': {'type': 'Polygon', 'coordinates': [
                [[-35,-9],[-34,-9],[-34,-8],[-35,-9]],
                [[-34.8,-8.8],[-34.7,-8.8],[-34.7,-8.7],[-34.8,-8.8]],
            ]}, 'data_extracao': datetime(2026,11,19,tzinfo=timezone.utc)}


class TestSgbExtract(unittest.TestCase):
    @patch('src.inundation.requests.get')
    def test_pagina_por_ids_e_rejeita_lote_incompleto(self, get):
        features = [feature(i) for i in range(1,202)]
        get.side_effect = [Mock(json=Mock(return_value=payload)) for payload in [
            {'objectIds': list(range(1,202))},
            {'type':'FeatureCollection','features':features[:200]},
            {'type':'FeatureCollection','features':features[200:]},
        ]]
        self.assertEqual(len(extract_inundation()),201)
        self.assertEqual(get.call_count,3)
        self.assertEqual(get.call_args.kwargs['params']['objectIds'],'201')
        get.side_effect = [Mock(json=Mock(return_value=payload)) for payload in [
            {'objectIds':[1,2]}, {'type':'FeatureCollection','features':[feature(1)]},
        ]]
        with self.assertRaisesRegex(ValueError,'incompleta'):
            extract_inundation()

    @patch('src.inundation.requests.get')
    def test_rejeita_erro_arcgis_e_limite_de_transferencia(self, get):
        get.return_value = Mock(json=Mock(return_value={'error':{'code':499}}))
        with self.assertRaisesRegex(ValueError,'recusada'):
            extract_inundation()
        get.side_effect = [Mock(json=Mock(return_value=payload)) for payload in [
            {'objectIds':[1]}, {'type':'FeatureCollection','exceededTransferLimit':True,'features':[feature()]},
        ]]
        with self.assertRaisesRegex(ValueError,'truncada'):
            extract_inundation()


class TestSgbSpark(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.spark = create_spark_session()
        cls.spark.sparkContext.setLogLevel('ERROR')

    @classmethod
    def tearDownClass(cls):
        cls.spark.stop()

    def test_normaliza_classe_deduplica_e_preserva_buracos(self):
        item = feature()
        rows = transform_inundation(self.spark,[item,deepcopy(item)])
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['classe'],'Média')
        self.assertEqual(rows[0]['ano'],2014)
        self.assertEqual(rows[0]['bbox'],[-35,-9,-34,-8])
        self.assertEqual(rows[0]['geometria'],item['geometry'])

    def test_rejeita_classe_desconhecida_conflitos_e_geometria_invalida(self):
        bad = feature()
        bad['properties']['classe'] = 'Desconhecida'
        with self.assertRaisesRegex(ValueError,'Classe'):
            transform_inundation(self.spark,[bad])
        bad = feature()
        bad['properties']['classe'] = 'Alta'
        with self.assertRaisesRegex(ValueError,'conflitante'):
            transform_inundation(self.spark,[feature(),bad])
        bad = feature()
        bad['geometry']['coordinates'][0][1][1] = 100
        with self.assertRaisesRegex(ValueError,'WGS84'):
            transform_inundation(self.spark,[bad])
        with self.assertRaisesRegex(ValueError,'vazia'):
            transform_inundation(self.spark,[])
