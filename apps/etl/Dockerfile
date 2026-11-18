FROM python:3.12-slim-bookworm AS prefect-server

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
COPY requirements-prefect.txt ./
RUN pip install --no-cache-dir -r requirements-prefect.txt
CMD ["prefect", "server", "start", "--host", "0.0.0.0"]

FROM prefect-server AS etl
RUN apt-get update \
    && apt-get install -y --no-install-recommends openjdk-17-jre-headless \
    && rm -rf /var/lib/apt/lists/*
COPY requirements-pipeline.txt ./
RUN pip install --no-cache-dir -r requirements-pipeline.txt
COPY run_etl.py orchestrate_prefect.py orchestrate_flood_points.py ./
COPY src/ ./src/
COPY sql/ ./sql/
CMD ["python", "run_etl.py", "--dataset", "alagamentos", "--engine", "spark", "--serve"]
