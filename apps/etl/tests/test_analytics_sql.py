import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


class AnalyticsSQLTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        candidates = sorted(Path("/usr/lib/postgresql").glob("*/bin/postgres"), reverse=True)
        binary = shutil.which("postgres") or (str(candidates[0]) if candidates else None)
        if not binary or os.geteuid() == 0:
            raise unittest.SkipTest("PostgreSQL local e usuário sem root necessários para testes SQL")
        cls.temp = tempfile.TemporaryDirectory(prefix="smartcity-sql-test-")
        cls.addClassCleanup(cls.temp.cleanup)
        cls.data = str(Path(cls.temp.name) / "data")
        cls.binary = binary
        subprocess.run([str(Path(binary).with_name("initdb")), "-D", cls.data,
                        "--no-locale", "--encoding=UTF8", "-A", "trust"],
                       capture_output=True, check=True, timeout=30)
        cls.ddl = (Path(__file__).resolve().parent.parent / "sql/smartcity_analytics.sql").read_text()

    def run_sql(self, assertions):
        setup = """
            TRUNCATE public.smartcity_ocorrencias, public.smartcity_ibge_bairros;
            INSERT INTO public.smartcity_ibge_bairros VALUES
                ('2611606001','Teste 1',100,10,10,100,2010,'lote-teste',now()),
                ('2611606002','Teste 2',300,90,0,0,2010,'lote-teste',now());
            INSERT INTO public.smartcity_ocorrencias VALUES
                (1,'SANEAMENTO','REGIAO_METROPOLITANA_DO_RECIFE','ABERTA','ALTA',now(),'lote-teste',now()),
                (2,'SANEAMENTO','REGIAO_METROPOLITANA_DO_RECIFE','RESOLVIDA','MEDIA',now(),'lote-teste',now()),
                (3,'COLETA_DE_LIXO','AGRESTE','EM_ANALISE','MEDIA',now(),'lote-teste',now());
        """
        result = subprocess.run([self.binary, "--single", "-j", "-D", self.data, "postgres"],
                                input=self.ddl + setup + assertions + "\n\n", text=True,
                                capture_output=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn("ERROR:", result.stderr, result.stderr)
        self.assertNotIn("FATAL:", result.stderr, result.stderr)

    def test_weighted_coverage_and_operational_counts(self):
        self.run_sql("""
            DO $$ BEGIN
                IF (SELECT cobertura_esgoto_municipio_contexto FROM public.smartcity_indicadores_regiao
                    WHERE regiao='REGIAO_METROPOLITANA_DO_RECIFE') IS DISTINCT FROM 10.00 THEN
                    RAISE EXCEPTION 'Cobertura deve ser 10 por cento, não média de 50';
                END IF;
                IF NOT EXISTS (SELECT 1 FROM public.smartcity_indicadores_regiao
                    WHERE regiao='REGIAO_METROPOLITANA_DO_RECIFE' AND ocorrencias=2
                    AND abertas=1 AND resolvidas=1 AND saneamento_pendentes=1
                    AND alta_prioridade_pendentes=1 AND populacao_municipio_contexto=400) THEN
                    RAISE EXCEPTION 'Contagens operacionais incorretas';
                END IF;
            END $$;
        """)

    def test_geographic_scope_and_regions_without_occurrences(self):
        self.run_sql("""
            DO $$ BEGIN
                IF (SELECT COUNT(*) FROM public.smartcity_indicadores_regiao) <> 5 THEN
                    RAISE EXCEPTION 'As cinco regiões devem estar presentes';
                END IF;
                IF EXISTS (SELECT 1 FROM public.smartcity_indicadores_regiao
                    WHERE regiao <> 'REGIAO_METROPOLITANA_DO_RECIFE'
                    AND (municipio_contexto IS NOT NULL OR populacao_municipio_contexto IS NOT NULL
                         OR cobertura_esgoto_municipio_contexto IS NOT NULL)) THEN
                    RAISE EXCEPTION 'IBGE de Recife indevidamente atribuído a outra região';
                END IF;
                IF NOT EXISTS (SELECT 1 FROM public.smartcity_indicadores_regiao
                    WHERE regiao='SERTAO' AND ocorrencias=0) THEN
                    RAISE EXCEPTION 'Região vazia deve retornar zero ocorrências';
                END IF;
            END $$;
        """)

    def test_missing_ibge_does_not_produce_misleading_aggregate(self):
        self.run_sql("""
            UPDATE public.smartcity_ibge_bairros SET domicilios_rede_geral=NULL,
                percentual_rede_esgoto=NULL WHERE codigo_bairro='2611606002';
            DO $$ BEGIN
                IF EXISTS (SELECT 1 FROM public.smartcity_indicadores_regiao
                    WHERE regiao='REGIAO_METROPOLITANA_DO_RECIFE'
                    AND cobertura_esgoto_municipio_contexto IS NOT NULL) THEN
                    RAISE EXCEPTION 'Agregado incompleto deve ser nulo';
                END IF;
            END $$;
        """)


if __name__ == "__main__":
    unittest.main()
