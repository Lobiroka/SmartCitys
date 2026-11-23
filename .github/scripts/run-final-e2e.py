"""Jornada real em dois Androids; não simula cadastro, status ou push por API."""
import argparse
from datetime import datetime, timezone
import html
import json
import os
from pathlib import Path
import secrets
import shutil
import signal
import subprocess
import sys
import threading
import time
import xml.etree.ElementTree as ET
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
APP_ID = 'com.darkartsbm.smartcitys'
PHASES = (
    ('citizen-register-and-report', 'citizen', 720),
    ('manager-update', 'manager', 420),
    ('citizen-notification', 'citizen', 240),
)


def redact(text, values):
    variants = set()
    for value in values:
        if value:
            variants.update((value, html.escape(value), json.dumps(value)[1:-1],
                             json.dumps(value, ensure_ascii=False)[1:-1]))
    for value in sorted(variants, key=len, reverse=True):
        text = text.replace(value, '[REDACTED]')
    return text


def sanitize_tree(output, values):
    for path in output.rglob('*'):
        if path.is_file() and path.suffix.lower() in ('.json', '.xml', '.txt', '.log', '.html'):
            content = path.read_text(encoding='utf-8', errors='replace')
            path.write_text(redact(content, values), encoding='utf-8')


def validate_devices(citizen, manager, listing):
    if citizen == manager:
        raise ValueError('Cidadão e gestor precisam de dispositivos distintos.')
    online = {line.split()[0] for line in listing.splitlines()
              if len(line.split()) == 2 and line.split()[1] == 'device'}
    if citizen not in online or manager not in online:
        raise ValueError('Os dois dispositivos precisam estar conectados e autorizados no ADB.')


def junit_passed(path):
    try:
        tree = ET.parse(path)
        cases = list(tree.iter('testcase'))
        suites = list(tree.iter('testsuite'))
        return bool(cases) and not any(
            list(tree.iter(tag)) for tag in ('failure', 'error', 'skipped')
        ) and not any(int(s.get(key, '0')) for s in suites
                      for key in ('failures', 'errors', 'skipped'))
    except (OSError, ET.ParseError, ValueError):
        return False


def stop_process(process):
    if process.poll() is not None:
        return
    if os.name == 'nt':
        subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    else:
        os.killpg(process.pid, signal.SIGTERM)


def execute(command, env, output, timeout, values):
    kwargs = ({'creationflags': subprocess.CREATE_NEW_PROCESS_GROUP} if os.name == 'nt'
              else {'start_new_session': True})
    process = subprocess.Popen(command, cwd=ROOT, env=env, stdout=subprocess.PIPE,
                               stderr=subprocess.STDOUT, text=True, encoding='utf-8',
                               errors='replace', **kwargs)
    expired = threading.Event()

    def expire():
        expired.set()
        stop_process(process)

    timer = threading.Timer(timeout, expire)
    timer.start()
    try:
        with (output / 'tests.log').open('w', encoding='utf-8') as log:
            for line in process.stdout:
                safe = redact(line, values)
                print(safe, end='', flush=True)
                log.write(safe)
        code = process.wait()
        return 124 if expired.is_set() else code
    except KeyboardInterrupt:
        stop_process(process)
        process.wait()
        return 130
    finally:
        timer.cancel()
        stop_process(process)
        process.wait()
        process.stdout.close()


def run_phases(maestro, devices, env, output, values, execute_phase=execute):
    report = {'run_id': output.name, 'title': env['MAESTRO_E2E_TITLE'],
              'devices': devices, 'development_client': env['MAESTRO_E2E_DEV_CLIENT'] == '1',
              'source_commit': env.get('SMARTCITYS_E2E_SOURCE_COMMIT'),
              'started_at': datetime.now(timezone.utc).isoformat(),
              'status': 'running', 'phases': []}
    report_path = output / 'execution.json'

    def save():
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')

    save()
    aggregate = ET.Element('testsuites')
    result = 1
    try:
        for name, role, timeout in PHASES:
            phase_dir = output / name
            phase_dir.mkdir()
            junit = phase_dir / 'results.xml'
            phase = {'name': name, 'device': devices[role], 'status': 'running'}
            print('Etapa: ' + name + ' — ' + devices[role], flush=True)
            report['phases'].append(phase)
            save()
            command = [maestro, '--device', devices[role], 'test', '--format', 'junit',
                       '--output', str(junit), '--debug-output', str(phase_dir / 'debug'),
                       '--test-output-dir', str(phase_dir),
                       str(ROOT / '.maestro/final' / (name + '.yaml'))]
            started = time.monotonic()
            code = execute_phase(command, env, phase_dir, timeout, values)
            passed = code == 0 and junit_passed(junit)
            phase.update(exit_code=code, duration_seconds=round(time.monotonic() - started, 3),
                         status='passed' if passed else 'failed')
            # O relatório agregado também falha quando o Maestro não entrega um JUnit válido.
            suite = ET.SubElement(aggregate, 'testsuite', name=name, tests='1',
                                  failures='0' if passed else '1')
            case = ET.SubElement(suite, 'testcase', name=name,
                                 time=str(phase['duration_seconds']))
            if not passed:
                ET.SubElement(case, 'failure', message='Falha de execução ou JUnit ausente/inválido')
                result = code or 1
                save()
                break
            save()
        else:
            result = 0
        return result
    finally:
        report['status'] = 'passed' if result == 0 else 'failed'
        report['finished_at'] = datetime.now(timezone.utc).isoformat()
        if result != 0 and not list(aggregate.iter('failure')):
            suite = ET.SubElement(aggregate, 'testsuite', name='incomplete-execution', tests='1', failures='1')
            case = ET.SubElement(suite, 'testcase', name='complete-journey')
            ET.SubElement(case, 'failure', message='A jornada não concluiu todas as etapas')
        for phase in report['phases']:
            if phase['status'] == 'running':
                phase['status'] = 'interrupted'
        save()
        ET.ElementTree(aggregate).write(output / 'results.xml', encoding='utf-8',
                                        xml_declaration=True)
        sanitize_tree(output, values)


def main():
    # Consoles Windows podem usar cp1252; logs Maestro e mensagens são UTF-8.
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--citizen-device', required=True)
    parser.add_argument('--manager-device', required=True)
    parser.add_argument('--credentials-file', type=Path)
    parser.add_argument('--dev-client', action='store_true')
    args = parser.parse_args()
    env = os.environ.copy()
    if args.credentials_file:
        data = json.loads(args.credentials_file.read_text(encoding='utf-8-sig'))
        for key in ('E2E_MANAGER_USERNAME', 'E2E_MANAGER_PASSWORD'):
            if isinstance(data.get(key), str):
                env[key] = data[key]
    required = ('E2E_MANAGER_USERNAME', 'E2E_MANAGER_PASSWORD')
    if any(not env.get(key) for key in required):
        parser.error('Configure E2E_MANAGER_USERNAME e E2E_MANAGER_PASSWORD do gestor de testes.')
    mode = '1' if args.dev_client else env.get('E2E_DEV_CLIENT', '0')
    if mode not in ('0', '1'):
        parser.error('E2E_DEV_CLIENT deve ser 0 ou 1.')
    sdk = Path(env.get('ANDROID_HOME', str(Path.home() / 'AppData/Local/Android/Sdk')))
    adb = shutil.which('adb') or str(sdk / 'platform-tools' / ('adb.exe' if os.name == 'nt' else 'adb'))
    maestro = shutil.which('maestro')
    if not maestro:
        parser.error('Instale Maestro CLI e adicione ao PATH.')
    listing = subprocess.check_output([adb, 'devices'], text=True, timeout=30)
    try:
        validate_devices(args.citizen_device, args.manager_device, listing)
    except ValueError as error:
        parser.error(str(error))
    for device in (args.citizen_device, args.manager_device):
        package = subprocess.check_output([adb, '-s', device, 'shell', 'pm', 'path', APP_ID],
                                          text=True, timeout=30)
        if not package.strip().startswith('package:'):
            parser.error('Instale o mesmo APK da branch nos dois dispositivos.')
        if mode == '1':
            subprocess.run([adb, '-s', device, 'reverse', 'tcp:8081', 'tcp:8081'],
                           check=True, timeout=30)
    run_id = uuid4().hex
    username = 'qa-final-' + run_id[:12]
    env.update(MAESTRO_E2E_USERNAME=username,
               MAESTRO_E2E_PASSWORD='E2e_' + secrets.token_hex(16) + '9!',
               MAESTRO_E2E_EMAIL=username + '@example.test',
               MAESTRO_E2E_TITLE='E2E final ' + run_id,
               MAESTRO_E2E_DEV_CLIENT=mode,
               MAESTRO_E2E_MANAGER_USERNAME=env['E2E_MANAGER_USERNAME'],
               MAESTRO_E2E_MANAGER_PASSWORD=env['E2E_MANAGER_PASSWORD'],
               MAESTRO_CLI_NO_ANALYTICS='1')
    values = [env[key] for key in ('MAESTRO_E2E_USERNAME', 'MAESTRO_E2E_PASSWORD',
                                  'MAESTRO_E2E_EMAIL', *required)]
    try:
        env['SMARTCITYS_E2E_SOURCE_COMMIT'] = subprocess.check_output(
            ['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True, timeout=10).strip()
    except (OSError, subprocess.SubprocessError):
        env.pop('SMARTCITYS_E2E_SOURCE_COMMIT', None)
    output = ROOT / 'test-results/e2e' / ('final-' + run_id)
    output.mkdir(parents=True)
    print('Executando cadastro real, foto/GPS, gestão e push. Evidências: ' + str(output), flush=True)
    return run_phases(maestro, {'citizen': args.citizen_device, 'manager': args.manager_device},
                      env, output, values)


if __name__ == '__main__':
    raise SystemExit(main())
