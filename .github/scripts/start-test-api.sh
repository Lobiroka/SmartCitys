#!/usr/bin/env bash
set -euo pipefail

mkdir -p "$RUNNER_TEMP/smartcitys-logs"
PORT=3002 node apps/backend/demand-service/dist/server.js > "$RUNNER_TEMP/smartcitys-logs/demand.log" 2>&1 &
PORT=3003 node apps/backend/metrics-service/dist/server.js > "$RUNNER_TEMP/smartcitys-logs/metrics.log" 2>&1 &
PORT=8080 node apps/backend/api-gateway/dist/server.js > "$RUNNER_TEMP/smartcitys-logs/gateway.log" 2>&1 &

for attempt in {1..60}; do
  if curl --fail --silent http://localhost:8080/health > /dev/null; then
    echo 'API e serviços de testes disponíveis.'
    exit 0
  fi
  sleep 2
done
echo '::error::API de testes não ficou disponível em 120 segundos.'
cat "$RUNNER_TEMP/smartcitys-logs/"*.log
exit 1
