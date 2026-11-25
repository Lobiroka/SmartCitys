#!/bin/sh
set -eu

case "${1:-}:${2:-}" in
  python:run_etl.py|python:serve_etl.py)
    : "${MONGODB_URI:?Configure MONGODB_URI no arquivo exclusivo da ETL}"
    : "${DATABASE_URL:?Configure DATABASE_URL com o escritor do banco prata}"
    ;;
esac

exec "$@"
