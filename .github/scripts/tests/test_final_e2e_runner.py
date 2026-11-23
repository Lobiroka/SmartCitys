import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location('final_runner', Path(__file__).parents[1] / 'run-final-e2e.py')
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class FinalRunnerTests(unittest.TestCase):
    def test_rejects_same_offline_and_missing_devices(self):
        for citizen, manager, listing in (
            ('a', 'a', 'a device'), ('a', 'b', 'a device\nb offline'),
            ('a', 'b', 'a device\nb unauthorized'), ('a', 'b', 'a device'),
        ):
            with self.subTest(listing=listing), self.assertRaises(ValueError):
                runner.validate_devices(citizen, manager, listing)
        runner.validate_devices('a', 'b', 'List of devices attached\na device\nb device\n')

    def test_junit_requires_cases_and_no_failure_error_skip_or_invalid_xml(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'results.xml'
            self.assertFalse(runner.junit_passed(path))
            for content in ('oops', '<testsuite/>',
                            '<testsuite failures="1"><testcase/></testsuite>',
                            '<testsuite><testcase><error/></testcase></testsuite>',
                            '<testsuite><testcase><skipped/></testcase></testsuite>'):
                path.write_text(content)
                self.assertFalse(runner.junit_passed(path))
            path.write_text('<testsuite><testcase/></testsuite>')
            self.assertTrue(runner.junit_passed(path))

    def test_only_three_successful_phases_approve_and_do_not_pass_secrets_as_arguments(self):
        with tempfile.TemporaryDirectory() as tmp:
            calls = []
            env = {'MAESTRO_E2E_TITLE': 'E2E final opaque', 'MAESTRO_E2E_DEV_CLIENT': '1',
                   'MAESTRO_E2E_PASSWORD': 'private-password'}

            def execute(command, environment, output, timeout, values):
                calls.append(command)
                self.assertEqual(environment['MAESTRO_E2E_PASSWORD'], 'private-password')
                self.assertNotIn('private-password', ' '.join(command))
                self.assertTrue((Path(tmp) / 'execution.json').exists())
                (output / 'results.xml').write_text('<testsuite><testcase/></testsuite>')
                (output / 'tests.log').write_text('private-password')
                return 0

            code = runner.run_phases('maestro', {'citizen': 'a', 'manager': 'b'}, env,
                                     Path(tmp), ['private-password'], execute)
            self.assertEqual(code, 0)
            self.assertEqual([c[2] for c in calls], ['a', 'b', 'a'])
            self.assertTrue(runner.junit_passed(Path(tmp) / 'results.xml'))
            self.assertEqual(json.loads((Path(tmp) / 'execution.json').read_text())['status'], 'passed')
            self.assertFalse(any('private-password' in p.read_text()
                                 for p in Path(tmp).rglob('*') if p.is_file()))

    def test_stops_after_nonzero_exit_or_missing_junit_even_with_zero_exit(self):
        for exit_code in (0, 1, 124, 130):
            with self.subTest(exit_code=exit_code), tempfile.TemporaryDirectory() as tmp:
                execute = Mock(return_value=exit_code)
                code = runner.run_phases('maestro', {'citizen': 'a', 'manager': 'b'},
                                         {'MAESTRO_E2E_TITLE': 'test', 'MAESTRO_E2E_DEV_CLIENT': '0'},
                                         Path(tmp), [], execute)
                self.assertNotEqual(code, 0)
                self.assertEqual(execute.call_count, 1)
                self.assertFalse(runner.junit_passed(Path(tmp) / 'results.xml'))

    def test_stops_only_owned_process_tree_and_preserves_finished_process(self):
        process = Mock(pid=123, poll=Mock(return_value=None))
        with patch.object(runner.os, 'name', 'nt'), patch.object(runner.subprocess, 'run') as run:
            runner.stop_process(process)
            self.assertEqual(run.call_args.args[0], ['taskkill', '/PID', '123', '/T', '/F'])
            process.poll.return_value = 0
            runner.stop_process(process)
            self.assertEqual(run.call_count, 1)

    def test_unexpected_exception_cannot_leave_a_green_aggregate(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(OSError):
                runner.run_phases('maestro', {'citizen': 'a', 'manager': 'b'},
                                  {'MAESTRO_E2E_TITLE': 'test', 'MAESTRO_E2E_DEV_CLIENT': '0'},
                                  Path(tmp), [], Mock(side_effect=OSError('fixture')))
            self.assertFalse(runner.junit_passed(Path(tmp) / 'results.xml'))
            report = json.loads((Path(tmp) / 'execution.json').read_text())
            self.assertEqual(report['status'], 'failed')
            self.assertEqual(report['phases'][0]['status'], 'interrupted')

    def test_sanitizes_xml_html_and_json_variants(self):
        value = 'secret<&"'
        text = ' '.join((value, runner.html.escape(value), json.dumps(value)[1:-1]))
        self.assertEqual(runner.redact(text, [value]), '[REDACTED] [REDACTED] [REDACTED]')


if __name__ == '__main__':
    unittest.main()
