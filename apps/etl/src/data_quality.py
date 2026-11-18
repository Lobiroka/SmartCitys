from datetime import datetime, timezone


REGIONS = ("REGIAO_METROPOLITANA_DO_RECIFE", "ZONA_DA_MATA", "AGRESTE", "SERTAO", "OUTRA")
CATEGORIES = ("ILUMINACAO_PUBLICA", "MANUTENCAO_DE_VIAS", "SANEAMENTO", "COLETA_DE_LIXO",
              "FISCALIZACAO", "SEGURANCA", "SINALIZACAO_DE_TRANSITO", "OUTROS_EMPECILHOS")
STATUSES = ("ABERTA", "EM_ANALISE", "RESOLVIDA")
PRIORITIES = ("ALTA", "MEDIA", "BAIXA")
OCCURRENCE_FIELDS = {"id_denuncia", "categoria", "regiao", "status", "prioridade", "data_registro"}


def validate_occurrences(rows: list[dict]) -> list[dict]:
    result, seen = [], set()
    for row in rows:
        if set(row) != OCCURRENCE_FIELDS:
            raise ValueError("Ocorrência fora do contrato: campos ausentes ou indevidos.")
        identifier = row["id_denuncia"]
        if type(identifier) is not int or identifier <= 0 or identifier in seen:
            raise ValueError("ID de ocorrência inválido ou duplicado.")
        seen.add(identifier)
        for column, allowed in (("regiao", REGIONS), ("categoria", CATEGORIES),
                                ("status", STATUSES), ("prioridade", PRIORITIES)):
            if row[column] not in allowed:
                raise ValueError(f"Valor desconhecido em {column}.")
        timestamp = datetime.fromisoformat(str(row["data_registro"]).replace("Z", "+00:00"))
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=timezone.utc)
        timestamp = timestamp.astimezone(timezone.utc)
        if timestamp > datetime.now(timezone.utc):
            raise ValueError("Ocorrência com data de registro no futuro.")
        result.append({**row, "data_registro": timestamp.isoformat()})
    return result


def validate_ibge_sources(population, sanitation):
    datasets = [population, sanitation["total"], sanitation["rede_geral"]]
    codes = []
    for rows in datasets:
        identifiers = [str(row.get("D1C", "")).strip() for row in rows
                       if str(row.get("D1C", "")).strip().isdigit()]
        if not identifiers or len(identifiers) != len(set(identifiers)):
            raise ValueError("IBGE: bairros ausentes ou códigos duplicados.")
        if any(not code.startswith("2611606") for code in identifiers):
            raise ValueError("IBGE: bairro fora do município do Recife.")
        if any(str(row.get("D3C", "")) != "2010" for row in rows
               if str(row.get("D1C", "")).strip().isdigit()):
            raise ValueError("IBGE: período diferente do contrato Censo 2010.")
        codes.append(set(identifiers))
    if not codes[0] == codes[1] == codes[2]:
        raise ValueError("IBGE: cobertura territorial divergente entre as três séries.")


def validate_indicators(rows: list[dict]):
    if not rows or len({row["codigo_bairro"] for row in rows}) != len(rows):
        raise ValueError("IBGE: resultado vazio ou com códigos duplicados.")
    for row in rows:
        if not row["bairro"] or row["ano"] != 2010:
            raise ValueError("IBGE: nome de bairro ou ano inválido.")
        for field in ("populacao", "domicilios_total", "domicilios_rede_geral"):
            value = row[field]
            if value is not None and (value < 0 or value != int(value)):
                raise ValueError(f"IBGE: contagem inválida em {field}.")
        total, network = row["domicilios_total"], row["domicilios_rede_geral"]
        if total is not None and network is not None and network > total:
            raise ValueError("IBGE: domicílios em rede excedem o total.")
        percent = row["percentual_rede_esgoto"]
        if percent is not None and not 0 <= percent <= 100:
            raise ValueError("IBGE: cobertura fora de 0–100%.")
