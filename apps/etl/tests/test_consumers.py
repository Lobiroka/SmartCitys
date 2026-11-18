from datetime import datetime, timezone
from pathlib import Path
import unittest
from unittest.mock import patch

from src.data_quality import REGIONS


def regions_fixture():
    rows = []
    for region in REGIONS:
        recife = region == REGIONS[0]
        rows.append({"regiao": region, "ocorrencias": 1 if recife else 0,
                     "abertas": 1 if recife else 0, "em_analise": 0, "resolvidas": 0,
                     "ocorrencias_saneamento": 1 if recife else 0,
                     "saneamento_pendentes": 1 if recife else 0,
                     "alta_prioridade_pendentes": 1 if recife else 0,
                     "primeiro_registro": None, "ultimo_registro": None,
                     "bairros_ibge": 1 if recife else None,
                     "populacao_municipio_contexto": 100 if recife else None,
                     "cobertura_esgoto_municipio_contexto": 50 if recife else None,
                     "nota_territorial": "Contexto municipal do Recife, Censo 2010"})
    return rows


class DashboardTests(unittest.TestCase):
    def test_dashboard_renders_and_region_without_ibge_has_no_context_metrics(self):
        from streamlit.testing.v1 import AppTest

        def query_fixture(sql, params=()):
            if "ibge_bairros" in sql:
                return [{"bairro": "Bairro sintético", "populacao": 100, "domicilios_total": 10,
                         "domicilios_rede_geral": 5, "percentual_rede_esgoto": 50, "ano": 2010}]
            return [{"regiao": REGIONS[0], "categoria": "SANEAMENTO", "status": "ABERTA", "ocorrencias": 1}]

        runs = [{"publicado_em": datetime(2026, 1, 1, tzinfo=timezone.utc), "motor": "pandas"}]
        with (patch("src.product_queries.regional_indicators", return_value=regions_fixture()),
              patch("src.product_queries.query", side_effect=query_fixture),
              patch("src.product_queries.pipeline_runs", return_value=runs)):
            app = AppTest.from_file(str(Path(__file__).resolve().parent.parent / "dashboard/app.py"))
            app.run(timeout=30)
            self.assertEqual(len(app.exception), 0)
            self.assertEqual(len(app.metric), 7)
            self.assertEqual(len(app.warning), 1)
            app.selectbox[0].set_value("AGRESTE").run(timeout=30)
            self.assertEqual(len(app.exception), 0)
            self.assertEqual(len(app.metric), 4)
            self.assertTrue(any("não tem indicadores IBGE" in item.value for item in app.info))


class MCPTests(unittest.TestCase):
    def test_mcp_exposes_product_without_ai_key(self):
        import asyncio
        from servidor import mcp

        tools = asyncio.run(mcp.get_tools())
        self.assertTrue({"indicadores_smartcity", "auditoria_pipeline", "contar_linhas"} <= tools.keys())
        with patch("src.product_queries.query", return_value=regions_fixture()):
            result = tools["indicadores_smartcity"].fn()
            self.assertEqual(len(result), 5)
            self.assertEqual(result[0]["regiao"], REGIONS[0])


if __name__ == "__main__":
    unittest.main()
