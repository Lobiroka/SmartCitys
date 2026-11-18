import importlib.util
import unittest
from unittest.mock import patch

from src.flood_points import extract_flood_points, transform_flood_points


def point(identifier, neighborhood="Boa Viagem", coordinates=None):
    return {
        "type": "Feature",
        "properties": {"OBJECTID": identifier, "BAIRRO": neighborhood},
        "geometry": {"type": "Point", "coordinates": coordinates or [-34.90, -8.10]},
    }


class FloodPointsTests(unittest.TestCase):
    def test_coordinates_and_neighborhood_aliases(self):
        rows = [point(1, "Santo Antônio"), point(2, " SANTO  ANTONIO "),
                point(3, None), point(4, coordinates=[-8.10, -34.90])]
        points = transform_flood_points(rows, "pandas")
        self.assertEqual(len(points), 3)
        self.assertEqual([item[1] for item in points], ["santo antonio", "santo antonio", None])
        self.assertEqual(points[0][3:], (-8.10, -34.90))

    def test_empty_invalid_or_duplicate_snapshot_is_refused(self):
        with self.assertRaisesRegex(ValueError, "Nenhum ponto"):
            transform_flood_points([point(1, coordinates=[0, 0])], "pandas")
        with self.assertRaisesRegex(ValueError, "duplicado"):
            transform_flood_points([point(1), point(1)], "pandas")

    @patch("src.flood_points._query")
    def test_complete_source_paging(self, query):
        ids = list(range(1, 202))
        query.side_effect = [
            {"objectIds": ids},
            {"type": "FeatureCollection", "features": [point(key) for key in ids[:200]]},
            {"type": "FeatureCollection", "features": [point(201)]},
        ]
        self.assertEqual(len(extract_flood_points()), 201)
        self.assertEqual(query.call_args.kwargs["objectIds"], "201")

    @patch("src.flood_points._query")
    def test_incomplete_page_is_refused(self, query):
        query.side_effect = [
            {"objectIds": [1, 2]},
            {"type": "FeatureCollection", "features": [point(1)]},
        ]
        with self.assertRaisesRegex(ValueError, "todos os pontos"):
            extract_flood_points()

    @unittest.skipUnless(importlib.util.find_spec("pyspark"), "PySpark ausente")
    def test_spark_and_local_engines_agree(self):
        rows = [point(1), point(2, None), point(3, coordinates=[0, 0])]
        self.assertEqual(sorted(transform_flood_points(rows, "spark")),
                         sorted(transform_flood_points(rows, "pandas")))
