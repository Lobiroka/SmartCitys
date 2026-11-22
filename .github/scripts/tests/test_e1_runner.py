import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('e1_runner', Path(__file__).parents[1] / 'run-e1.py')
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class E1RunnerTests(unittest.TestCase):
    def environment(self, **extra):
        return {
            'E2E_USERNAME': 'citizen-fixture', 'E2E_PASSWORD': 'password-fixture',
            'E2E_GESTOR_TOKEN': 'manager-token-fixture',
            'E2E_API_URL': 'https://api.example.test', **extra,
        }

    def run_fixture(self, **extra):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            process = SimpleNamespace(stdout=io.StringIO('password-fixture\n'), wait=lambda: 0)
            with patch.dict(os.environ, self.environment(**extra), clear=True), \
                    patch.object(runner, '__file__', str(root / '.github/scripts/run-e1.py')), \
                    patch.object(runner.os, 'chdir'), \
                    patch.object(runner.shutil, 'which', return_value='maestro-fixture'), \
                    patch.object(runner.subprocess, 'Popen', return_value=process) as launch, \
                    patch.object(runner.runpy, 'run_path') as sanitize, \
                    patch('sys.stdout', new_callable=io.StringIO):
                self.assertEqual(runner.main(), 0)
            execution = next(root.rglob('execution.json'))
            report = json.loads(execution.read_text(encoding='utf-8'))
            command = launch.call_args.args[0]
            environment = launch.call_args.kwargs['env']
            self.assertNotIn('password-fixture', ' '.join(command))
            self.assertNotIn('manager-token-fixture', ' '.join(command))
            self.assertNotIn('password-fixture', execution.with_name('tests.log').read_text(encoding='utf-8'))
            sanitize.assert_called_once()
            return report, environment

    def test_standalone_remains_default_even_with_inherited_maestro_flag(self):
        report, environment = self.run_fixture(MAESTRO_E2E_DEV_CLIENT='1')
        self.assertFalse(report['development_client'])
        self.assertEqual(environment['MAESTRO_E2E_DEV_CLIENT'], '0')

    def test_development_mode_is_explicit_and_recorded(self):
        report, environment = self.run_fixture(E2E_DEV_CLIENT='1')
        self.assertTrue(report['development_client'])
        self.assertEqual(environment['MAESTRO_E2E_DEV_CLIENT'], '1')

    def test_invalid_mode_does_not_start_maestro(self):
        with patch.dict(os.environ, self.environment(E2E_DEV_CLIENT='true'), clear=True), \
                patch.object(runner.os, 'chdir'), \
                patch.object(runner.subprocess, 'Popen') as launch:
            with self.assertRaisesRegex(SystemExit, 'E2E_DEV_CLIENT'):
                runner.main()
            launch.assert_not_called()


if __name__ == '__main__':
    unittest.main()
