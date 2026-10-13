#!/usr/bin/env bash
set -euo pipefail

mkdir -p test-results/e2e
capture_failure() {
  local result=$?
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

# O APK inclui o bundle JavaScript e não depende do Metro.
maestro test \
  --format junit --output test-results/e2e/results.xml \
  --debug-output test-results/e2e/debug \
  --test-output-dir test-results/e2e/maestro \
  -e E2E_USERNAME="$E2E_USERNAME" \
  -e E2E_PASSWORD="$E2E_PASSWORD" \
  -e E2E_TITLE="Ocorrencia CI ${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}" \
  .maestro/mvp.yaml
