import importlib.util
import unittest
from copy import deepcopy
from unittest.mock import patch

from src.bronze import snapshot_id
from src.data_quality import validate_occurrences
from src.product_queries import regional_indicators
from src.product_transform import transform_product


def sidra(values):
    return [{"D1C": "Bairro (Código)", "D1N": "Bairro", "D3C": "Ano (Código)", "V": "Valor"},
            *[{"D1C": f"2611606{index:03d}", "D1N": f"Bairro teste {index}",
               "D3C": "2010", "V": str(value)} for index, value in enumerate(values, 1)]]


def fixtures():
    return (sidra([100, 300]), {"total": sidra([10, 90]), "rede_geral": sidra([10, 0])},
            [{"id_denuncia": 1, "categoria": "SANEAMENTO", "regiao": "REGIAO_METROPOLITANA_DO_RECIFE",
              "status": "ABERTA", "prioridade": "ALTA", "data_registro": "2026-01-01T10:00:00-03:00"}])


class ProductTests(unittest.TestCase):
    def test_bronze_content_is_order_independent_and_source_specific(self):
        rows = fixtures()[0]
        self.assertEqual(snapshot_id("populacao", rows), snapshot_id("populacao", rows[::-1]))
        self.assertNotEqual(snapshot_id("populacao", rows), snapshot_id("saneamento", rows))
        changed = deepcopy(rows)
        changed[1]["V"] = "101"
        self.assertNotEqual(snapshot_id("populacao", rows), snapshot_id("populacao", changed))

    def test_treated_counts_and_percentages(self):
        result = transform_product(*fixtures(), engine="pandas")
        self.assertEqual(len(result["ibge"]), 2)
        self.assertEqual([r["percentual_rede_esgoto"] for r in result["ibge"]], [100, 0])
        self.assertEqual(result["ocorrencias"][0]["data_registro"], "2026-01-01T13:00:00+00:00")

    def test_missing_value_is_not_zero_and_zero_denominator_has_no_percentage(self):
        population, sanitation, occurrences = fixtures()
        sanitation["rede_geral"][1]["V"] = "..."
        sanitation["total"][2]["V"] = "0"
        result = transform_product(population, sanitation, occurrences, "pandas")
        self.assertIsNone(result["ibge"][0]["domicilios_rede_geral"])
        self.assertTrue(all(r["percentual_rede_esgoto"] is None for r in result["ibge"]))

    def test_duplicate_or_incomplete_ibge_is_rejected(self):
        population, sanitation, occurrences = fixtures()
        with self.assertRaisesRegex(ValueError, "duplicados"):
            transform_product([*population, population[1]], sanitation, occurrences, "pandas")
        sanitation["total"].pop()
        with self.assertRaisesRegex(ValueError, "territorial"):
            transform_product(population, sanitation, occurrences, "pandas")

    def test_wrong_census_or_municipality_is_rejected(self):
        population, sanitation, occurrences = fixtures()
        population[1]["D3C"] = "2022"
        with self.assertRaisesRegex(ValueError, "período"):
            transform_product(population, sanitation, occurrences, "pandas")
        population[1]["D3C"] = "2010"
        population[1]["D1C"] = "9999999001"
        with self.assertRaisesRegex(ValueError, "município"):
            transform_product(population, sanitation, occurrences, "pandas")

    def test_impossible_coverage_and_unknown_number_are_rejected(self):
        population, sanitation, occurrences = fixtures()
        sanitation["rede_geral"][1]["V"] = "11"
        with self.assertRaisesRegex(ValueError, "excedem"):
            transform_product(population, sanitation, occurrences, "pandas")
        sanitation["rede_geral"][1]["V"] = "erro"
        with self.assertRaisesRegex(ValueError, "numérico"):
            transform_product(population, sanitation, occurrences, "pandas")

    def test_private_fields_and_unknown_regions_are_rejected(self):
        rows = fixtures()[2]
        with self.assertRaisesRegex(ValueError, "campos"):
            validate_occurrences([{**rows[0], "email_solicitante": "teste@example.test"}])
        with self.assertRaisesRegex(ValueError, "regiao"):
            validate_occurrences([{**rows[0], "regiao": "INVENTADA"}])

    def test_duplicate_occurrences_do_not_silently_change_counts(self):
        rows = fixtures()[2]
        with self.assertRaisesRegex(ValueError, "duplicado"):
            validate_occurrences(rows * 2)

    def test_empty_operational_snapshot_is_valid(self):
        population, sanitation, _ = fixtures()
        self.assertEqual(transform_product(population, sanitation, [], "pandas")["ocorrencias"], [])

    @patch("src.product_queries.query")
    def test_regional_query_is_parameterized_and_rejects_unknown_region(self, query):
        regional_indicators("AGRESTE")
        self.assertEqual(query.call_args.args[1], ("AGRESTE",))
        with self.assertRaises(ValueError):
            regional_indicators("AGRESTE'; DELETE FROM smartcity_ocorrencias; --")
        self.assertEqual(query.call_count, 1)

    @unittest.skipUnless(importlib.util.find_spec("pyspark"), "PySpark não instalado neste ambiente")
    def test_spark_matches_pandas_including_empty_source(self):
        population, sanitation, occurrences = fixtures()
        for source in (occurrences, []):
            spark = transform_product(population, sanitation, source, "spark")
            pandas = transform_product(population, sanitation, source, "pandas")
            self.assertEqual(spark["ibge"], pandas["ibge"])
            self.assertEqual(validate_occurrences(spark["ocorrencias"]), pandas["ocorrencias"])


if __name__ == "__main__":
    unittest.main()
