"""Remove credenciais dos arquivos de texto antes de publicar evidências."""
import os
import html
import json
from pathlib import Path

values = set()
for name in ('E2E_USERNAME', 'E2E_PASSWORD'):
    value = os.environ.get(name, '')
    if value:
        values.update((value, html.escape(value),
                       json.dumps(value)[1:-1], json.dumps(value, ensure_ascii=False)[1:-1]))
for path in Path('test-results/e2e').rglob('*'):
    if not path.is_file() or path.suffix.lower() not in ('.json', '.xml', '.txt', '.log', '.html'):
        continue
    content = path.read_text(encoding='utf-8', errors='replace')
    for value in sorted(values, key=len, reverse=True):
        content = content.replace(value, '[REDACTED]')
    path.write_text(content, encoding='utf-8')
