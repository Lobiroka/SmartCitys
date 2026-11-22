#!/usr/bin/env bash
set -euo pipefail

mkdir -p test-results/e2e
started_at=$SECONDS
fixture_created=false
capture_failure() {
  local result=$?
  if [ "$fixture_created" = true ]; then
    node .github/scripts/e3-fixture.cjs verify || result=1
    node .github/scripts/e3-fixture.cjs cleanup || result=1
  fi
  printf '{"exit_code":%s,"duration_seconds":%s}\n' "$result" "$((SECONDS - started_at))" > test-results/e2e/execution.json
  if [ "$result" -ne 0 ]; then
    adb exec-out screencap -p > test-results/e2e/failure.png || true
    adb shell uiautomator dump /sdcard/e2e-hierarchy.xml > /dev/null 2>&1 || true
    adb pull /sdcard/e2e-hierarchy.xml test-results/e2e/hierarchy.xml > /dev/null 2>&1 || true
  fi
  python .github/scripts/sanitize-e2e.py
  exit "$result"
}
trap capture_failure EXIT
adb shell wm size 720x1280
adb shell wm density 320
# Aguarda serviços de primeiro boot antes de iniciar o aplicativo e o navegador.
sleep 20
adb reverse tcp:8080 tcp:8080
adb emu geo fix -34.877 -8.0476
adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk

node .github/scripts/e3-fixture.cjs create
fixture_created=true
foreign_id=$(node -p "require('./test-results/e2e/e3-fixture.json').id")
foreign_title=$(node -p "require('./test-results/e2e/e3-fixture.json').title")
foreign_description=$(node -p "require('./test-results/e2e/e3-fixture.json').description")
invalid_description=$(node -p "require('./test-results/e2e/e3-fixture.json').invalidDescription")
test_status=0

# O APK inclui o bundle JavaScript e não depende do Metro.
maestro test \
  --format junit --output test-results/e2e/mvp-results.xml \
  --debug-output test-results/e2e/debug \
  --test-output-dir test-results/e2e/maestro \
  -e E2E_USERNAME="$E2E_USERNAME" \
  -e E2E_PASSWORD="$E2E_PASSWORD" \
  -e E2E_TITLE="Ocorrencia CI ${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}" \
  .maestro/mvp.yaml || test_status=1

maestro test \
  --format junit --output test-results/e2e/negative-results.xml \
  --debug-output test-results/e2e/negative-debug \
  --test-output-dir test-results/e2e/negative-maestro \
  -e E2E_USERNAME="$E2E_USERNAME" \
  -e E2E_PASSWORD="$E2E_PASSWORD" \
  -e E3_FOREIGN_ID="$foreign_id" \
  -e E3_FOREIGN_TITLE="$foreign_title" \
  -e E3_FOREIGN_DESCRIPTION="$foreign_description" \
  -e E3_INVALID_DESCRIPTION="$invalid_description" \
  .maestro/negativos/registro-sem-titulo.yaml \
  .maestro/negativos/acesso-ocorrencia-alheia.yaml || test_status=1

python - <<'PY'
from pathlib import Path
import xml.etree.ElementTree as ET
directory = Path('test-results/e2e')
root = ET.Element('testsuites')
for name, expected in (('mvp-results.xml', 1), ('negative-results.xml', 2)):
    report = ET.parse(directory / name).getroot()
    if len(list(report.iter('testcase'))) != expected:
        raise SystemExit('Quantidade inesperada de casos E2E em ' + name)
    root.append(report)
ET.ElementTree(root).write(directory / 'results.xml', encoding='utf-8', xml_declaration=True)
PY
exit "$test_status"
