#!/usr/bin/env bash
set -euo pipefail

mkdir -p test-results/e2e
adb reverse tcp:8080 tcp:8080
adb emu geo fix -34.877 -8.0476
adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk

# O APK inclui o bundle JavaScript e não depende do Metro.
maestro test \
  --format junit --output test-results/e2e/results.xml \
  --debug-output test-results/e2e/debug \
  -e E2E_USERNAME="$E2E_USERNAME" \
  -e E2E_PASSWORD="$E2E_PASSWORD" \
  -e E2E_TITLE="Ocorrencia CI ${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}" \
  .maestro/mvp.yaml
