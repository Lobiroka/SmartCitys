FROM python:3.12-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHON_DOTENV_DISABLED=1 \
    JAVA_HOME=/opt/java \
    PREFECT_HOME=/home/etl/.prefect \
    PREFECT_CLI_PROMPT=false \
    SPARK_MASTER="local[1]" \
    PYSPARK_SUBMIT_ARGS="--driver-memory 512m --executor-memory 512m pyspark-shell"

RUN apt-get update \
    && apt-get install -y --no-install-recommends openjdk-17-jre-headless ca-certificates procps \
    && ln -s "$(dirname "$(dirname "$(readlink -f "$(command -v java)")")")" /opt/java \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 --shell /usr/sbin/nologin etl \
    && mkdir -p /app /home/etl/.prefect \
    && chown -R etl:etl /app /home/etl

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=etl:etl src/*.py ./src/
COPY --chown=etl:etl orchestrate_prefect.py orchestrate_inundation.py run_etl.py serve_etl.py ./
COPY --chown=etl:etl docker-entrypoint.sh ./
RUN chmod 755 docker-entrypoint.sh

USER etl
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["python", "serve_etl.py"]
