import hashlib
import json
from datetime import date, datetime, timezone

from pymongo import MongoClient, UpdateOne

from src.config import MONGODB_DATABASE, MONGODB_URI, require_config


def canonical_json(value) -> str:
    def encode(item):
        if isinstance(item, (date, datetime)):
            return item.isoformat()
        raise TypeError(f"Tipo não suportado na bronze: {type(item).__name__}")

    return json.dumps(value, sort_keys=True, ensure_ascii=False, default=encode,
                      separators=(",", ":"), allow_nan=False)


def snapshot_id(dataset: str, records: list[dict]) -> str:
    content = dataset + "\n" + "\n".join(sorted(canonical_json(row) for row in records))
    return hashlib.sha256(content.encode()).hexdigest()


class BronzeStore:
    def __init__(self):
        self.client = MongoClient(require_config("MONGODB_URI", MONGODB_URI),
                                  serverSelectionTimeoutMS=15000)
        self.db = self.client[MONGODB_DATABASE]
        self.db["smartcity_bronze_registros"].create_index("lote_id")

    def close(self):
        self.client.close()

    def write(self, dataset: str, records: list[dict]) -> str:
        records = sorted((json.loads(canonical_json(row)) for row in records),
                         key=canonical_json)
        token = snapshot_id(dataset, records)
        collection = self.db["smartcity_bronze_registros"]
        operations = [UpdateOne(
            {"_id": f"{token}:{position}"},
            {"$setOnInsert": {"lote_id": token, "posicao": position, "dado": row}},
            upsert=True,
        ) for position, row in enumerate(records)]
        for start in range(0, len(operations), 1000):
            collection.bulk_write(operations[start:start + 1000], ordered=False)
        if collection.count_documents({"lote_id": token}) != len(records):
            raise RuntimeError("Carga bronze incompleta; manifesto não publicado.")
        self.db["smartcity_bronze_lotes"].update_one(
            {"_id": token},
            {"$setOnInsert": {"dataset": dataset, "quantidade": len(records),
                              "data_extracao": datetime.now(timezone.utc),
                              "completo": True}},
            upsert=True,
        )
        return token

    def read(self, token: str) -> list[dict]:
        manifest = self.db["smartcity_bronze_lotes"].find_one({"_id": token, "completo": True})
        if manifest is None:
            raise ValueError("Snapshot bronze ausente ou incompleto.")
        records = [item["dado"] for item in self.db["smartcity_bronze_registros"]
                   .find({"lote_id": token}).sort("posicao", 1)]
        if (len(records) != manifest["quantidade"]
                or snapshot_id(manifest["dataset"], records) != token):
            raise RuntimeError("Integridade do snapshot bronze inválida.")
        return records
