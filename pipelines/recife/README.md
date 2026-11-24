# Pipeline pública do Recife

Pipeline Python independente do app Android e do npm. Não altera Expo SDK,
Keycloak ou CRUD. O produto consulta apenas a API do monorepo, que lê o banco:

```text
APIs IBGE/SIDRA + limites da Prefeitura + SGB
  → MongoDB bronze: JSON bruto e snapshots SHA-256
  → Apache Spark: limpeza, tipos, nulos, deduplicação e integração geográfica
  → PostgreSQL/Neon prata: transações, validações e upserts
  → Metrics/Gateway autenticado → app Android
```

Os módulos de execução são os mesmos validados em duas cargas completas com
fontes públicas reais. Serviços de consulta MCP e Streamlit,
exports de prévia, dados, credenciais e ambientes virtuais não fazem parte deste
recorte. Versões diretas estão fixadas em `requirements.txt`; dependências
transitivas não constituem um lock completo.

## Preparar e executar

Use Python 3.12 e Java 17, versões do ambiente validado. Requer MongoDB
autenticado e PostgreSQL/Neon provisionados em ambiente autorizado. Execute nesta pasta:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp sample.env .env
# Preencha .env localmente com as conexões autorizadas; nunca versione ou imprima.
python run_etl.py
```

`MONGODB_URI` é a conexão bronze. `DATABASE_URL` usa o papel de carga no banco
prata, com permissão para criar/atualizar as três tabelas no schema `public`.
`DATABASE_URL_READONLY` identifica o leitor separado; não use o papel de carga no
produto. No Metrics, configure essa conexão leitora como `DATABASE_URL_ETL`,
preservando `DATABASE_URL_DEMAND`. O leitor precisa de `CONNECT`, `USAGE` no
schema e `SELECT` apenas nas tabelas publicadas; sua criação é uma operação do
administrador do ambiente, separada da execução da pipeline.

`src/config.py` centraliza o ambiente e lê somente o `.env` desta pasta quando
habilitado. Para executar usando exclusivamente variáveis externas, defina
`PYTHON_DOTENV_DISABLED=1` e todas as conexões **antes** de iniciar o Python.
Não envie conexões como parâmetros Prefect nem coloque credenciais no app.

O flow principal inclui IBGE, limites e o subflow SGB. Para atualizar somente
SGB, use `python orchestrate_inundation.py`. Na execução manual sem
`PREFECT_API_URL`, Prefect pode iniciar seu servidor temporário. Em máquina
pequena, `SPARK_MASTER=local[1]` e `PYSPARK_SUBMIT_ARGS` com driver/executor de
512 MB foram suficientes no ensaio; configure essas variáveis no processo.

## Orquestração e agendamento

Para o painel e runner locais, em terminais separados:

```bash
prefect server start --host 127.0.0.1
# No terminal do runner, com as conexões locais já carregadas:
export PREFECT_API_URL=http://127.0.0.1:4200/api
python serve_etl.py
```

O deployment `recife-diario` usa `ETL_CRON=0 3 * * *`, fuso
`America/Recife` (03h locais), tentativas nas tasks e concorrência global/local
igual a 1. O runner deve permanecer ativo; seu encerramento pausa a agenda.
Executar `run_etl.py` não instala uma agenda permanente. Publicação, permissões,
secret manager e operação Mongo Atlas/Neon/Prefect em nuvem são ativação separada,
coordenada pelo responsável; os comandos acima não publicam a infraestrutura.

## Contratos da camada prata

| Tabela `public` | Chave e campos consumidos pelo Metrics |
|---|---|
| `recife_populacao_saneamento` | `codigo_bairro` textual; `bairro`, `populacao`, `domicilios_total`, `domicilios_rede_geral`, `percentual_rede_esgoto`, `ano`, `data_extracao` |
| `recife_bairros_limites` | `codigo_bairro`; `geometria` JSONB Polygon/MultiPolygon WGS84, `fonte`, `data_extracao` |
| `recife_inundacao_sgb` | `id` BIGINT; `classe` Baixa/Média/Alta, `ano`, `descricao_fonte`, `geometria` JSONB WGS84, `bbox` `[minLon,minLat,maxLon,maxLat]`, `fonte`, `data_extracao` |

Mongo guarda uma versão por conteúdo, preservando o bruto e a coleta UTC; nova
observação de conteúdo igual não duplica o snapshot. A transformação lê o
snapshot exato persistido, não um resultado direto da API. Indicadores e limites
são publicados atomicamente. SGB tem transação própria, advisory lock, upsert e
sincronização de IDs somente após validar uma coleta completa. Falhas preservam
as versões prata anteriores; uma falha SGB não apaga indicadores já publicados.

Os limites são associados aos códigos SIDRA por nomes normalizados e
correspondência explícita Cohab–Ibura de Cima; conflitos ou cobertura incompleta
abortam a carga. Nulos não viram zero; geometrias preservam buracos e
multipolígonos. Mudar o ano ou incluir vários anos exige revisar chave/contrato:
o modelo atual guarda um recorte anual, não uma série histórica.

Fontes: [IBGE/SIDRA](https://apisidra.ibge.gov.br/),
[limites oficiais do Recife](https://esigportal2.recife.pe.gov.br/arcgis/rest/services/Planejamento/BASES_LIMITESOFICIAIS_LOGRADOUROS/FeatureServer/5),
[SGB/CPRM](https://geoportal.sgb.gov.br/server/rest/services/gestaoterritorial/inundacao/FeatureServer/0).
O ensaio obteve 94 bairros/limites e 422 áreas SGB. IBGE tem referência **2010**;
SGB consultado tem referência **2014**. `data_extracao` é coleta, não ano do
indicador. Suscetibilidade não é alerta de alagamento atual; ausência de polígono
não significa classe baixa. Ocorrências por população não demonstram causalidade.

## Testes

A suíte curada contém 13 testes unitários/Spark e uma integração opt-in. Os
unitários exercitam Spark real, mas simulam APIs/persistência e não carregam
bancos. Para impedir carregamento de `.env` e desativar a integração no Linux:

```bash
env -u ETL_TEST_MONGODB_URI -u ETL_TEST_DATABASE_URL \
  PYTHON_DOTENV_DISABLED=1 SPARK_MASTER='local[1]' \
  python -m unittest discover -s tests -v
```

A integração requer `ETL_TEST_MONGODB_URI` e `ETL_TEST_DATABASE_URL` explicitamente
apontando para **serviços locais descartáveis de testes**. Nunca use RDS, Neon
compartilhado, banco de desenvolvimento ou credencial de produção. Ela cria um
banco Mongo e uma tabela PostgreSQL com UUID `etl_test_…`, valida duas cargas e
rollback e remove somente esses recursos ao terminar. É opt-in por variáveis;
o código não determina se o banco é descartável. Execute com responsabilidade:

```bash
# Com ETL_TEST_* exclusivamente locais definidos no ambiente:
PYTHON_DOTENV_DISABLED=1 python -m unittest discover -s tests -p test_integration.py -v
```

Fixtures sintéticas existem apenas nos testes, sem fallback no produto. Os testes
unitários não comprovam conexão cloud; o ensaio real separado comprovou APIs →
Mongo → Spark → PostgreSQL local, repetição sem duplicatas e papel leitor sem
escrita. Revalidar a conexão e agenda no ambiente efetivo antes da apresentação.
