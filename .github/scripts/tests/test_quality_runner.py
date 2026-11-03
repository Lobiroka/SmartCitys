import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location("quality_runner", Path(__file__).parents[1] / "run-quality-tests.py")
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class RunnerTests(unittest.TestCase):
    def test_failed_tests_keep_exit_code_and_log_and_npm_flags(self):
        with tempfile.TemporaryDirectory() as directory:
            fake_file = str(Path(directory) / ".github/scripts/run-quality-tests.py")
            process = Mock(stdout=["Teste falhou\n"])
            process.wait.return_value = 7
            with patch.object(runner, "__file__", fake_file), patch("sys.argv", ["runner", "mobile"]), patch.object(subprocess, "Popen", return_value=process) as spawn:
                self.assertEqual(runner.main(), 7)
            command = spawn.call_args.args[0]
            self.assertEqual(command[:7], ["npm", "run", "test", "--workspace", "@smart-city/mobile", "--", "--json"])
            output = Path(directory) / "test-results/mobile"
            self.assertEqual(json.loads((output / "execution.json").read_text())["exit_code"], 7)
            self.assertIn("Teste falhou", (output / "tests.log").read_text(encoding="utf-8"))

    def test_missing_executable_is_recorded_as_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            fake_file = str(Path(directory) / ".github/scripts/run-quality-tests.py")
            with patch.object(runner, "__file__", fake_file), patch("sys.argv", ["runner", "api", "--cwd", "backend"]), patch.object(subprocess, "Popen", side_effect=OSError("npm ausente")):
                self.assertEqual(runner.main(), 1)
            output = Path(directory) / "test-results/api"
            self.assertEqual(json.loads((output / "execution.json").read_text())["exit_code"], 1)


if __name__ == "__main__":
    unittest.main()
