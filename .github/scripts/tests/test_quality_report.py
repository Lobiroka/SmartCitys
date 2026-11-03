import importlib.util
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

    def report(self, expected=("mobile",), outcomes=None, job="success"):
        with patch.dict(os.environ, {"GITHUB_STEP_SUMMARY": ""}):
            return quality.build(self.root, expected, outcomes or {"mobile": "success"}, job)

    def test_success_and_html_escape(self):
        self.fixture()
        result = self.report()
        self.assertEqual(result["status"], "VERDE")
        self.assertEqual(result["success_rate"], 100)
        for name in ("technical", "business"):
            content = (self.root / f"quality/{name}.html").read_text(encoding="utf-8")
            self.assertNotIn("{{", content)
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

    def test_no_tests_is_inconclusive_not_100_percent(self):
        self.fixture(statuses=())
        result = self.report()
        self.assertIsNone(result["success_rate"])
        self.assertEqual(result["status"], "INCONCLUSIVO")

    def test_missing_suite_and_early_failure(self):
        self.fixture()
        result = self.report(("mobile", "api", "e2e"), job="failure")
        self.assertTrue(result["partial"])
        self.assertEqual(result["status"], "INCONCLUSIVO")

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


if __name__ == "__main__":
    unittest.main()
