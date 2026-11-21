import json
import os
from pathlib import Path
import runpy
import shutil
import subprocess
import time
from urllib.parse import urlparse
from uuid import uuid4


def main():
    root = Path(__file__).resolve().parents[2]
    os.chdir(root)
    required = ('E2E_USERNAME', 'E2E_PASSWORD', 'E2E_API_URL', 'E2E_GESTOR_TOKEN')
    missing = [key for key in required if not os.environ.get(key)]
    if missing:
        raise SystemExit('Configure no ambiente: ' + ', '.join(missing))
    url = urlparse(os.environ['E2E_API_URL'])
    if (not url.hostname or url.username or url.password or url.query or url.fragment or
        url.path not in ('', '/') or
        not (url.scheme == 'https' or
             url.scheme == 'http' and url.hostname in ('localhost', '127.0.0.1', '::1'))):
        raise SystemExit('E2E_API_URL deve ser a origem HTTPS da API de testes ou HTTP loopback.')
    maestro = shutil.which('maestro')
    if not maestro:
        raise SystemExit('Instale o Maestro CLI e adicione-o ao PATH.')
    output = root / 'test-results' / 'e2e' / ('e1-' + uuid4().hex)
    output.mkdir(parents=True)
    environment = os.environ.copy()
    for name in required:
        environment['MAESTRO_' + name] = environment[name]
    environment['MAESTRO_E2E_TITLE'] = 'E1 ' + uuid4().hex
    command = [maestro, 'test', '--format', 'junit', '--output', str(output / 'results.xml'),
               '--debug-output', str(output / 'debug'), '--test-output-dir', str(output),
               str(root / '.maestro/registrar-acompanhar-notificar.yaml')]
    started = time.monotonic()
    code = 1
    secrets = [environment[name] for name in ('E2E_USERNAME', 'E2E_PASSWORD', 'E2E_GESTOR_TOKEN')]
    try:
        with (output / 'tests.log').open('w', encoding='utf-8') as log:
            process = subprocess.Popen(command, cwd=root, env=environment,
                                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                       text=True, encoding='utf-8', errors='replace')
            for line in process.stdout:
                for secret in sorted(secrets, key=len, reverse=True):
                    line = line.replace(secret, '[REDACTED]')
                print(line, end='', flush=True)
                log.write(line)
            code = process.wait()
    finally:
        (output / 'execution.json').write_text(json.dumps({
            'exit_code': code, 'duration_seconds': round(time.monotonic() - started, 3),
            'title': environment['MAESTRO_E2E_TITLE'],
        }), encoding='utf-8')
        runpy.run_path(str(root / '.github/scripts/sanitize-e2e.py'))
        print('Evidências E1: ' + str(output))
    return code


if __name__ == '__main__':
    raise SystemExit(main())
