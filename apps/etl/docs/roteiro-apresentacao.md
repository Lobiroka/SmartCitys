# Roteiro de apresentação — Observatório SmartCity

## 1. Problema e produto

“O SmartCity registra demandas urbanas. Nosso produto usa essas ocorrências e
os indicadores públicos tratados pelo grupo para apoiar a leitura das demandas
de saneamento e infraestrutura. Dashboard e MCP acessam o banco da disciplina.”

Mostre a região, os totais por status e as demandas de saneamento. Apresente o
contexto municipal do Recife com o ano de referência. A interface é a saída do
trabalho de engenharia de dados; dedique a maior parte do tempo ao fluxo abaixo.

## 2. Fontes e recorte correto

Mostre `src/extract.py`: API SIDRA, tabelas 202 e 1394, bairros do Recife,
Censo 2010. Mostre `src/smartcity_source.py`: leitura de `demand.denuncias`,
com seis campos analíticos e transação somente leitura.

Explique a diferença entre município, bairro e região do app. O indicador do
Recife não representa toda a região metropolitana. Não existe uma chave de
bairro nas ocorrências atuais; o produto apresenta contexto identificado,
sem inventar taxas por habitante ou uma correlação por bairro.

## 3. Bronze: histórico e reprocessamento

Mostre `src/bronze.py` e as coleções MongoDB:

- `smartcity_bronze_registros`: registros recebidos, separados por lote;
- `smartcity_bronze_lotes`: dataset, quantidade, checksum/ID e primeira extração.

Execute a pipeline completa. O dado público vai para o MongoDB antes de ser
relido e transformado. Mostre os quatro lotes na execução: população,
saneamento total, saneamento em rede e ocorrências.

```bash
python run_etl.py --engine spark
```

No MongoDB, compare os documentos de um lote com a quantidade do manifesto.
Reprocessar não precisa buscar arbitrariamente “a última carga”: os IDs exatos
da bronze são propagados para a transformação.

## 4. Transformação e qualidade

Mostre `src/product_transform.py` e `src/data_quality.py`:

- códigos territoriais únicos e mesmos bairros nas três séries;
- ano do Censo e município validados;
- 94 bairros esperados, configurados na execução;
- tipos numéricos, ausência preservada como nulo e divisão por zero protegida;
- junção dos indicadores por código IBGE;
- cobertura entre zero e 100 e rede não superior ao total;
- valores de região/status/categoria compatíveis com o schema real do app;
- datas das ocorrências normalizadas para UTC.

Spark realiza as junções e o cálculo dos indicadores, além da conversão de
datas. O motor efetivo aparece na auditoria: só apresente uma execução como
Spark quando o campo `motor` for `spark`.

## 5. Prata, ouro e transação

Mostre `sql/smartcity_analytics.sql` e `src/product_store.py`:

- prata: `smartcity_ibge_bairros` e `smartcity_ocorrencias`;
- ouro: `smartcity_indicadores_regiao` e `smartcity_ocorrencias_categoria`;
- auditoria: `smartcity_pipeline_execucoes`.

Explique PK, upsert, remoção de registros ausentes do snapshot e publicação
em transação. Se uma validação falha, a versão anterior no Neon permanece.
O banco operacional é apenas origem de leitura.

A cobertura municipal é ponderada por domicílios: soma ligada à rede dividida
pela soma do total. Não é média simples dos percentuais dos bairros. Se falta
uma parcela, a cobertura municipal fica nula.

## 6. Prova de idempotência e atualização

Registre as contagens e os lotes. Execute novamente com as fontes sem alterações:

```bash
python run_etl.py --engine spark
```

```sql
SELECT COUNT(*) AS total, COUNT(DISTINCT id_denuncia) AS ids_unicos
FROM public.smartcity_ocorrencias;

SELECT COUNT(*) AS total, COUNT(DISTINCT codigo_bairro) AS bairros_unicos
FROM public.smartcity_ibge_bairros;

SELECT inicio, publicado_em, motor, bairros, ocorrencias, lotes
FROM public.smartcity_pipeline_execucoes
ORDER BY publicado_em DESC LIMIT 2;
```

Os conjuntos estáveis têm o mesmo lote bronze e as mesmas contagens na prata.
A auditoria terá outra linha porque houve outra execução. Se alguém alterar
uma ocorrência durante a demonstração, um novo lote é o comportamento esperado.

Para demonstrar atualização real: altere **uma ocorrência de teste pelo próprio
app**, rode outra carga e mostre o novo status no produto, sem duplicar seu ID.
Para demonstrar exclusão, use somente uma ocorrência de teste autorizada.

## 7. Prefect e consumo

Mostre o fluxo e seus estados no Prefect: extração → bronze → releitura →
transformação → publicação. Mostre retries nas operações externas e o erro de
qualidade separado de uma falha de conexão.

Se a agenda estiver de fato servida, mostre o deployment e o próximo horário.
O padrão é 06h no fuso de Recife; apenas executar uma carga não ativa a agenda.

Abra o dashboard e use um filtro. Mostre que `src/product_queries.py` usa
somente `DATABASE_URL` do Neon. Como alternativa de produto, demonstre as
ferramentas MCP `indicadores_smartcity` e `auditoria_pipeline`, sem necessidade
de chave de IA.

## Verificações antes de apresentar

- Instalar PySpark e Java 17 e executar os testes, incluindo o teste Spark.
- Configurar `SMARTCITY_DATABASE_URL` e conferir as três conexões no `.env`.
- Executar ao menos uma publicação completa com as fontes reais.
- Confirmar que o motor, os lotes e as contagens constam na auditoria.
- Executar duas cargas para obter a evidência real de idempotência.
- Abrir dashboard e/ou cliente MCP e conferir os resultados com SQL.
- Se for demonstrar agenda, manter Prefect e o processo `--serve` ativos.

Os testes locais usam fixtures sintéticas e não comprovam uma carga em nuvem.
Não apresente dados de teste como se tivessem sido extraídos das fontes reais.
