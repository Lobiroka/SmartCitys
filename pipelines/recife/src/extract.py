import requests
from pymongo import MongoClient

from src.config import MONGODB_URI, REFERENCE_YEAR
from src.geography import BOUNDARIES_URL


class Extract:





    CIDADES = {
        "recife": "2611606"
    }

    TABELAS = {
        "populacao": "202",
        "saneamento": "1394"
    }

    POPULACAO = {
        "variavel": "93",
        "sexo": "0",
        "situacao": "0",
        "ano": str(REFERENCE_YEAR)
    }

    SANEAMENTO = {
        "variavel": "96",
        "situacao": "0",
        "banheiro": "0",
        "tipo_domicilio": "0",
        "condicao_ocupacao": "0",
        "total_esgoto": "0",
        "rede_geral": "92855",
        "ano": str(REFERENCE_YEAR)
    }

    NIVEL_BAIRRO = "n102"

    def __init__(self):




        self.base_url = (
            "https://apisidra.ibge.gov.br/values"
        )

        self.codigo_recife = self.CIDADES["recife"]
        self.cidade = "Recife"

    def _get(self, url: str) -> list[dict]:










        response = requests.get(
            url,
            timeout=60
        )

        response.raise_for_status()

        return response.json()

    def bairros_recife(
        self,
        cidade: str = "recife"
    ) -> list[dict]:











        cidade = cidade.lower()

        if cidade not in self.CIDADES:
            raise ValueError(
                "Cidade inválida. Utilize 'recife'."
            )

        codigo = self.CIDADES[cidade]

        url = (
            f"{self.base_url}/"
            f"t/{self.TABELAS['populacao']}/"
            f"{self.NIVEL_BAIRRO}/"
            f"IN%20N6%20{codigo}/"
            f"v/{self.POPULACAO['variavel']}/"
            f"c2/{self.POPULACAO['sexo']}/"
            f"c1/{self.POPULACAO['situacao']}/"
            f"p/{self.POPULACAO['ano']}"
        )

        return self._get(url)

    def saneamento_recife(
        self,
        cidade: str = "recife"
    ) -> dict[str, list[dict]]:












        cidade = cidade.lower()

        if cidade not in self.CIDADES:
            raise ValueError(
                "Cidade inválida. Utilize 'recife'."
            )

        codigo = self.CIDADES[cidade]

        url_total = (
            f"{self.base_url}/"
            f"t/{self.TABELAS['saneamento']}/"
            f"{self.NIVEL_BAIRRO}/"
            f"IN%20N6%20{codigo}/"
            f"v/{self.SANEAMENTO['variavel']}/"
            f"c1/{self.SANEAMENTO['situacao']}/"
            f"c458/{self.SANEAMENTO['banheiro']}/"
            f"c125/{self.SANEAMENTO['tipo_domicilio']}/"
            f"c63/{self.SANEAMENTO['condicao_ocupacao']}/"
            f"c11558/{self.SANEAMENTO['total_esgoto']}/"
            f"p/{self.SANEAMENTO['ano']}"
        )

        url_rede = (
            f"{self.base_url}/"
            f"t/{self.TABELAS['saneamento']}/"
            f"{self.NIVEL_BAIRRO}/"
            f"IN%20N6%20{codigo}/"
            f"v/{self.SANEAMENTO['variavel']}/"
            f"c1/{self.SANEAMENTO['situacao']}/"
            f"c458/{self.SANEAMENTO['banheiro']}/"
            f"c125/{self.SANEAMENTO['tipo_domicilio']}/"
            f"c63/{self.SANEAMENTO['condicao_ocupacao']}/"
            f"c11558/{self.SANEAMENTO['rede_geral']}/"
            f"p/{self.SANEAMENTO['ano']}"
        )

        total = self._get(url_total)
        rede_geral = self._get(url_rede)

        return {
            "total": total,
            "rede_geral": rede_geral
        }

    def limites_bairros_recife(self) -> list[dict]:
        """Obtém limites oficiais em longitude/latitude WGS84, sem geocodificação online no app."""
        response = requests.get(BOUNDARIES_URL, params={
            "where": "1=1", "outFields": "CBAIRRCODI,EBAIRRNOMEOF",
            "outSR": 4326, "f": "geojson", "geometryPrecision": 6,
            "resultRecordCount": 1000, "orderByFields": "CBAIRRCODI",
        }, timeout=60)
        response.raise_for_status()
        payload = response.json()
        if payload.get("type") != "FeatureCollection" or payload.get("exceededTransferLimit"):
            raise ValueError("Resposta de limites inválida ou incompleta")
        return payload["features"]

    def extract_collection_from_mongo(
        self,
        database: str,
        collection: str,
        snapshot_id: str | None = None,
    ) -> list[dict]:











        if not MONGODB_URI:
            raise ValueError("A variável MONGODB_URI não foi definida no .env")
        client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=10000, tz_aware=True)

        try:
            db = client[database]

            coll = db[collection]
            # Snapshots novos são atômicos e endereçados pelo conteúdo.
            query = {"_id": snapshot_id} if snapshot_id else {"tipo": "bronze_snapshot"}
            snapshot = coll.find_one(query, sort=[("ultima_observacao", -1)])
            if snapshot is not None and snapshot.get("tipo") == "bronze_snapshot":
                return [
                    {**item, "data_extracao": snapshot["data_extracao"]}
                    for item in snapshot["registros"]
                ]
            if snapshot_id is not None:
                raise ValueError("Snapshot bronze não encontrado")

            # Compatibilidade de leitura com cargas anteriores à integração.
            latest = coll.find_one(
                {"data_extracao": {"$exists": True}},
                {"_id": 0, "data_extracao": 1},
                sort=[("data_extracao", -1)],
            )
            if latest is None:
                return list(coll.find({}, {"_id": 0}))
            return list(coll.find(
                {"data_extracao": latest["data_extracao"]},
                {"_id": 0},
            ))

        finally:
            client.close()
