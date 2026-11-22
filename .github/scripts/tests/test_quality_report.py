import importlib.util
import hashlib
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import xml.etree.ElementTree as ET

spec = importlib.util.spec_from_file_location("quality_report", Path(__file__).parents[1] / "quality-report.py")
quality = importlib.util.module_from_spec(spec)
spec.loader.exec_module(quality)


class QualityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def fixture(self, name="mobile", statuses=("passed",), coverage=80):
        path = self.root / name
        path.mkdir(parents=True, exist_ok=True)
        cases = [{"fullName": f"Caso {i} <script>alert(1)</script>", "status": status,
                  "failureMessages": ["Falha <script>" ] if status == "failed" else [], "duration": 50}
                 for i, status in enumerate(statuses)]
        (path / "results.json").write_text(json.dumps({"numTotalTests": len(cases), "testResults": [
            {"status": "failed" if "failed" in statuses else "passed", "assertionResults": cases}]}), encoding="utf-8")
        (path / "execution.json").write_text(json.dumps({"duration_seconds": 1.5,
                                                          "exit_code": 1 if "failed" in statuses else 0}))
        if coverage is not None:
            (self.root / "mobile/coverage").mkdir(parents=True, exist_ok=True)
            (self.root / "mobile/coverage/coverage-summary.json").write_text(json.dumps({"total": {
                key: {"pct": coverage} for key in ("lines", "branches", "functions", "statements")}}))

    def report(self, expected=("mobile",), outcomes=None, job="success", assessments=quality.ASSESSMENTS):
        with patch.dict(os.environ, {"GITHUB_STEP_SUMMARY": ""}):
            return quality.build(self.root, expected, outcomes or {"mobile": "success"}, job, assessments)

    def assessment_file(self, **changes):
        entry = {
            'suite': 'mobile', 'test': 'Caso 0 <script>alert(1)</script>',
            'failure_sha256': hashlib.sha256('Falha <script>'.encode()).hexdigest(),
            'cause': 'sut', 'diagnosis': 'O requisito de criação foi violado na reprodução.',
            'evidence': 'https://github.com/example/app/issues/42', 'reviewer': 'Revisor da fixture',
            'residual_risk': 'A criação permanece bloqueada até corrigir e validar o defeito.',
        }
        entry.update(changes)
        path = self.root / 'assessments.json'
        path.write_text(json.dumps([entry]), encoding='utf-8')
        return path

    def test_success_and_html_escape(self):
        self.fixture()
        result = self.report()
        self.assertEqual(result["status"], "VERDE")
        self.assertEqual(result["success_rate"], 100)
        for name in ("technical", "business"):
            content = (self.root / f"quality/{name}.html").read_text(encoding="utf-8")
            self.assertNotIn("{{", content)
            self.assertIn('Esta rotina não incluiu roteiros completos no Android', content)
        ET.parse(self.root / "mobile/normalized.xml")

    def test_failure_cannot_be_hidden_by_percentage(self):
        self.fixture(statuses=("passed",) * 99 + ("failed",))
        result = self.report(outcomes={"mobile": "failure"})
        self.assertEqual(result["status"], "VERMELHO")
        self.assertEqual(result["success_rate"], 99)
        content = (self.root / "quality/technical.html").read_text(encoding="utf-8")
        self.assertNotIn("<script>", content)
        self.assertIn("&lt;script&gt;", content)

    def test_skips_are_not_executed(self):
        self.fixture(statuses=("passed", "pending", "todo"))
        result = self.report()
        self.assertEqual(result["executed"], 1)
        self.assertEqual(result["counts"]["skipped"], 2)
        self.assertEqual(result["status"], "AMARELO")
        explanation = quality.html_presentation(result)
        self.assertIn('2 testes não executados', explanation['STATUS_REASONS_HTML'])
        self.assertNotIn('Não recebi a medição de cobertura', explanation['STATUS_REASONS_HTML'])
        self.assertIn('motivo de cada teste não executado', explanation['NEXT_STEPS_HTML'])

    def test_no_tests_is_inconclusive_not_100_percent(self):
        self.fixture(statuses=())
        result = self.report()
        self.assertIsNone(result["success_rate"])
        self.assertEqual(result["status"], "INCONCLUSIVO")
        explanation = quality.html_presentation(result)
        self.assertIn('Não há testes executados', explanation['STATUS_REASONS_HTML'])
        self.assertEqual(explanation['APPROVAL_RATE'], 'Não calculada')

    def test_missing_suite_and_early_failure(self):
        self.fixture()
        result = self.report(("mobile", "api", "e2e"), job="failure")
        self.assertTrue(result["partial"])
        self.assertEqual(result["status"], "INCONCLUSIVO")
        self.assertIn('Não recebi resultados de roteiros completos no Android',
                      quality.html_presentation(result)['ANDROID_CASES_HTML'])

    def test_android_cases_keep_individual_results_and_escape_names(self):
        self.fixture()
        directory = self.root / 'e2e'
        directory.mkdir()
        (directory / 'results.xml').write_text(
            '<testsuites><testsuite><testcase name="Entrar e registrar ocorrência"/>'
            '<testcase name="Notificação no Android"><skipped/></testcase>'
            '<testcase name="Proteção &lt;script&gt;"><failure>Falha no roteiro</failure></testcase>'
            '</testsuite></testsuites>')
        result = self.report(('mobile', 'e2e'), {'mobile': 'success', 'e2e': 'failure'})
        cases = quality.html_presentation(result)['ANDROID_CASES_HTML']
        self.assertIn('Entrar e registrar ocorrência', cases)
        self.assertIn('Passou</span>', cases)
        self.assertIn('Não executado</span>', cases)
        self.assertIn('Falhou</span>', cases)
        self.assertIn('Proteção &lt;script&gt;', cases)
        self.assertNotIn('<script>', cases)
        self.assertEqual(result['status'], 'VERMELHO')

    def test_malformed_input_still_produces_reports(self):
        (self.root / "mobile").mkdir()
        (self.root / "mobile/results.json").write_text("invalid json")
        result = self.report()
        self.assertEqual(result["status"], "INCONCLUSIVO")
        self.assertTrue((self.root / "quality/business.html").exists())

    def test_failed_process_without_failed_case_is_inconclusive(self):
        self.fixture()
        self.assertEqual(self.report(outcomes={"mobile": "failure"})["status"], "INCONCLUSIVO")

    def test_missing_and_low_coverage_are_attention(self):
        self.fixture(coverage=None)
        self.assertEqual(self.report()["status"], "AMARELO")
        self.fixture(coverage=69)
        self.assertEqual(self.report()["status"], "AMARELO")

    def test_junit_nested_suites_failure_and_error(self):
        directory = self.root / "e2e"
        directory.mkdir()
        (directory / "results.xml").write_text('<testsuites><testsuite><testsuite><testcase name="Login" time="2"/><testcase name="CRUD"><failure>falhou</failure></testcase><testcase name="GPS"><skipped/></testcase><testcase name="Foto"><error>erro</error></testcase></testsuite></testsuite></testsuites>')
        suite = quality.read_suite(self.root, "e2e", "failure")
        self.assertEqual(suite["counts"], {"passed": 1, "failed": 2, "skipped": 1})
        self.assertEqual(suite["duration_seconds"], 2)

    def test_secret_redaction_before_html_generation(self):
        self.fixture(statuses=("failed",))
        log = self.root / "mobile/tests.log"
        log.write_text('senha-teste postgresql://app:outra-senha@host/db')
        with patch.dict(os.environ, {"E2E_PASSWORD": "senha-teste"}):
            self.report(outcomes={"mobile": "failure"})
        content = log.read_text()
        self.assertNotIn("senha-teste", content)
        self.assertNotIn("outra-senha", content)

    def test_ansi_and_control_characters_produce_valid_xml(self):
        self.fixture(statuses=("failed",))
        path = self.root / "mobile/results.json"
        data = json.loads(path.read_text())
        data["testResults"][0]["assertionResults"][0]["failureMessages"] = ["\x1b[31mFalha\x1b[0m\x00"]
        path.write_text(json.dumps(data))
        self.report(outcomes={"mobile": "failure"})
        ET.parse(self.root / "mobile/normalized.xml")

    def test_wrong_json_shape_is_inconclusive(self):
        self.fixture()
        (self.root / "mobile/results.json").write_text("[]")
        self.assertEqual(self.report()["status"], "INCONCLUSIVO")

    def test_high_approval_is_explained_without_approving_failures(self):
        self.fixture(statuses=('passed',) * 99 + ('failed',))
        result = self.report(outcomes={'mobile': 'failure'})
        self.assertIn('99.00%', result['approval_interpretation'])
        self.assertIn('sem aprovação', result['approval_interpretation'])
        self.assertEqual(result['sut_failures'], 0)
        self.assertEqual(result['pending_failures'], 1)
        for name in ('technical.html', 'business.html', 'summary.md'):
            content = (self.root / 'quality' / name).read_text(encoding="utf-8")
            self.assertIn('Triagem pendente' if name.endswith('.md') else 'Causa ainda em investigação', content)
            self.assertIn('99.00%' if name.endswith('.md') else '99,00%', content)
            if name.endswith('.html'):
                self.assertIn('VERMELHO', content)
                self.assertIn('antes de aprovar a entrega', content)
            self.assertNotIn('{{', content)

    def test_sut_failure_requires_matching_reviewed_assessment(self):
        self.fixture(statuses=('failed',))
        path = self.assessment_file()
        result = self.report(outcomes={'mobile': 'failure'}, assessments=path)
        self.assertEqual(result['sut_failures'], 1)
        self.assertEqual(result['pending_failures'], 0)
        content = (self.root / 'quality/business.html').read_text(encoding="utf-8")
        self.assertIn('Defeito do aplicativo ou de seus serviços', content)
        self.assertIn('https://github.com/example/app/issues/42', content)
        self.assertIn('A criação permanece bloqueada', content)
        self.assertNotIn('<script>', content)
        self.assertEqual(result['status'], 'VERMELHO')

    def test_environment_failure_does_not_become_sut_defect(self):
        self.fixture(statuses=('failed',))
        result = self.report(outcomes={'mobile': 'failure'},
                             assessments=self.assessment_file(cause='environment'))
        self.assertEqual(result['sut_failures'], 0)
        self.assertEqual(result['failure_assessments'][0]['cause'], 'environment')
        self.assertEqual(result['status'], 'VERMELHO')
        explanation = quality.html_presentation(result)
        self.assertIn('Problema no ambiente de testes', explanation['ASSESSMENTS_HTML'])
        self.assertNotIn('<strong>Defeito do aplicativo', explanation['ASSESSMENTS_HTML'])

    def test_changed_failure_does_not_reuse_old_diagnosis(self):
        self.fixture(statuses=('failed',))
        result = self.report(outcomes={'mobile': 'failure'},
                             assessments=self.assessment_file(failure_sha256='0' * 64))
        self.assertEqual(result['sut_failures'], 0)
        self.assertEqual(result['pending_failures'], 1)

    def test_unreviewed_or_conflicting_assessments_are_not_applied(self):
        self.fixture(statuses=('failed',))
        for key in ('reviewer', 'evidence', 'diagnosis', 'residual_risk'):
            with self.subTest(key=key):
                result = self.report(outcomes={'mobile': 'failure'},
                                     assessments=self.assessment_file(**{key: ''}))
                self.assertEqual(result['pending_failures'], 1)
                self.assertTrue(result['assessment_problems'])
        path = self.assessment_file()
        entries = json.loads(path.read_text(encoding="utf-8"))
        path.write_text(json.dumps(entries * 2))
        result = self.report(outcomes={'mobile': 'failure'}, assessments=path)
        self.assertEqual(result['sut_failures'], 0)
        self.assertTrue(result['assessment_problems'])

    def test_partial_success_and_skips_keep_residual_risk(self):
        self.fixture(statuses=('passed', 'pending'))
        result = self.report(('mobile', 'api'), job='failure')
        self.assertIn('100.00%', result['approval_interpretation'])
        self.assertIn('parcial', result['approval_interpretation'])
        self.assertIn('Excluí 1 casos ignorados', result['approval_interpretation'])
        self.assertTrue(any('api' in risk for risk in result['residual_risks']))
        self.assertEqual(result['status'], 'INCONCLUSIVO')

    def test_no_execution_is_not_interpreted_as_success(self):
        self.fixture(statuses=())
        result = self.report()
        self.assertIn('N/D', result['approval_interpretation'])
        self.assertEqual(result['sut_failures'], 0)
        self.assertTrue(result['residual_risks'])


if __name__ == "__main__":
    unittest.main()
