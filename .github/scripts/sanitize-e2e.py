"""Remove credenciais dos arquivos de texto antes de publicar evidências."""
import os
from pathlib import Path

values = [os.environ.get(name, '') for name in ('E2E_USERNAME', 'E2E_PASSWORD')]
for path in Path('test-results/e2e').rglob('*'):
    if not path.is_file() or path.suffix.lower() not in ('.json', '.xml', '.txt', '.log', '.html'):
        continue
    content = path.read_text(encoding='utf-8', errors='replace')
    for value in values:
        if value:
            content = content.replace(value, '[REDACTED]')
    path.write_text(content, encoding='utf-8')
