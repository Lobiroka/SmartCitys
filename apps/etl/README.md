# Observatório SmartCity — produto baseado em dados

O produto reúne ocorrências reais do SmartCity e os indicadores de população e
saneamento coletados pelo grupo no IBGE. Dashboard e servidor MCP consultam
exclusivamente o **Neon da disciplina**, depois da passagem pela pipeline.
O aplicativo mobile continua usando seu backend e autenticação existentes.

## Fluxo implementado

```mermaid
flowchart TD
    A["API SIDRA / IBGE"] --> C["Bronze: MongoDB"]
    B["Banco SmartCity: leitura de demand.denuncias"] --> C
    C --> D["Validação e transformação Spark"]
    D --> E["Prata: tabelas no Neon"]
    E --> F["Ouro: views no Neon"]
    F --> G["Dashboard e MCP"]
```

O Prefect coordena extração, escrita bronze, releitura dos lotes, transformação
e publicação. Requisições e operações de banco têm tentativas com intervalo;
erros de qualidade interrompem o fluxo antes da publicação.

| Requisito | Implementação |
| --- | --- |
| APIs públicas do grupo | SIDRA, tabelas 202 e 1394, mesmas consultas do projeto original |
| Bronze | `smartcity_bronze_registros` e `smartcity_bronze_lotes`, no MongoDB |
| Transformação | PySpark: tipagem, junção por código de bairro, cobertura e datas UTC |
| Prata | `smartcity_ibge_bairros` e `smartcity_ocorrencias`, no Neon |
| Ouro | Views `smartcity_indicadores_regiao` e `smartcity_ocorrencias_categoria` |
| Idempotência | SHA-256 do conteúdo na bronze; PK e upsert na prata; views sem duplicação |
| Qualidade | Contratos de campos, ano, município, unicidade, completude e cobertura válida |
| Rastreabilidade | Lotes, início, publicação, motor e contagens em `smartcity_pipeline_execucoes` |
| Agendamento | Deployment Prefect servido pelo processo local, cron e fuso de Recife |
| Credenciais | `.env` centralizado em `src/config.py`; nenhuma senha no produto |
| Produto | Dashboard Streamlit e ferramentas MCP, ambos lendo somente do Neon |

## Limite territorial dos dados atuais

**As regiões do app não são os bairros do IBGE.** O schema real do SmartCity
usa Região Metropolitana do Recife, Zona da Mata, Agreste, Sertão e Outra.
A coleta pública atual cobre somente os bairros do **município do Recife,
Censo 2010**. O app não tem código IBGE de bairro ou município na ocorrência.

Por isso, o produto mostra as ocorrências por região, categoria e status e
apresenta os indicadores municipais do Recife como **contexto identificado**
na região metropolitana. Nas demais regiões, o indicador público fica nulo e
o produto informa a ausência de cobertura. Não calcula ocorrência por
habitante da região, nem atribui ocorrências a bairros pelo texto do endereço.

Para um cruzamento territorial exato, será necessário acrescentar código de
município/bairro ao cadastro, ou relacionar coordenadas a uma malha territorial
validada, além de ampliar a coleta pública para os territórios correspondentes.
Essa evolução ainda não está implementada. Os períodos das duas fontes também
são diferentes; a data do Censo permanece visível.

## Configuração

Para executar a pipeline localmente, entre em `apps/etl` e use Python 3.10–3.12 e Java 17 para Spark 3.5:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

Se já existe `.env`, **edite-o preservando as credenciais atuais**. Se ainda
não existe, crie-o a partir de `.env.example`. As três conexões são diferentes:

```dotenv
MONGODB_URI=mongodb+srv://USUARIO:SENHA@CLUSTER.mongodb.net/
MONGODB_DATABASE=IBGE
DATABASE_URL=postgresql://USUARIO:SENHA@HOST_NEON/neondb?sslmode=require
SMARTCITY_DATABASE_URL=postgresql://LEITOR:SENHA@HOST_SMARTCITY/BANCO?sslmode=require
TRANSFORM_ENGINE=spark
SPARK_MASTER=local[2]
PIPELINE_CRON=0 6 * * *
```

`DATABASE_URL` é o **destino analítico da disciplina**. `SMARTCITY_DATABASE_URL`
é a origem operacional usada pelo serviço de ocorrências do SmartCity, hoje
configurado para o schema `demand`. Não é o banco de identidade do Keycloak.
Use uma conta com permissão de leitura em `demand.denuncias`; a extração também
abre uma transação somente leitura. A conta Neon precisa criar tabelas/views
e escrever nos objetos analíticos próprios da pipeline.

A extração copia apenas `id_denuncia`, `categoria`, `regiao`, `status`,
`prioridade` e `data_registro`. Não copia cidadão, e-mail, título, endereço,
coordenadas, descrição, imagens, tokens ou dados do Keycloak.

## Executar e abrir o produto

```bash
# Pipeline completa com Spark, incluindo IBGE e ocorrências reais:
python run_etl.py --engine spark

# Mesma pipeline em uma máquina sem Spark; não conta como demonstração de Spark:
python run_etl.py --engine pandas

# Produto web, depois de concluir a publicação no Neon:
python -m streamlit run dashboard/app.py

# Cliente MCP sem chave de IA, consultando o mesmo Neon:
python cliente_teste.py
```

O dashboard tem filtro regional, contagens por status, demandas de saneamento,
pendências de alta prioridade, contexto IBGE, tabela por bairro, exportação CSV
e auditoria das execuções. Não faz requisições ao IBGE nem ao banco operacional.

## Orquestração e agenda Prefect

Para uma execução imediata, `python orchestrate_prefect.py --engine spark`
é equivalente a `run_etl.py`. Para acompanhar execuções em um servidor local:

```bash
# Terminal 1, com a venv ativa:
prefect server start

# Terminal 2, com a venv ativa:
export PREFECT_API_URL=http://127.0.0.1:4200/api
python orchestrate_prefect.py --serve --engine spark
```

O segundo comando registra e serve `smartcity-diario`. O padrão do `.env`
executa diariamente às **06h em America/Recife**, com limite global de uma
execução por vez. O processo servidor e o processo que serve o deployment
precisam permanecer em execução. O código de agenda está pronto; executar uma
carga isolada não significa que a agenda foi ativada.

## Idempotência e consistência

- A bronze ordena os registros e calcula uma chave SHA-256 por conjunto e conteúdo.
  O mesmo conteúdo reutiliza os documentos; um conteúdo diferente gera outro lote.
- O manifesto só é publicado após conferir a quantidade de documentos. O próximo
  estágio recebe os IDs exatos dos quatro lotes, verifica contagem e checksum e
  não depende da consulta à carga mais recente de cada coleção.
- As três séries IBGE devem ter os mesmos códigos, sem duplicatas, ano 2010 e
  bairros do Recife. Valores ausentes continuam nulos; um número ilegível falha.
- A prata faz upsert por chave e remove, **somente nas tabelas analíticas próprias**,
  os registros ausentes do snapshot completo. Assim, uma ocorrência excluída no
  app também sai do produto após a próxima carga. A fonte operacional não é alterada.
- Publicação, contagens, views e auditoria pertencem à mesma transação. O lock
  de publicação impede mistura de snapshots; uma execução mais antiga não pode
  substituir outra mais recente. Uma falha reverte essa publicação no Neon.
- Uma nova execução acrescenta uma linha de auditoria; isso é histórico de
  execução, não duplicação dos indicadores ou ocorrências.
- A cobertura municipal usa `SUM(rede) / SUM(total) × 100`, ponderada por domicílios.
  Se faltam parcelas, o agregado fica nulo; não usa média simples dos bairros.

A extração atual carrega snapshots completos em memória; é adequada ao volume
acadêmico e aos 94 bairros esperados do Recife. Aumentar muito o volume de
ocorrências exige paginação/streaming e uma política de retenção da bronze.

## Conferências para a apresentação

```sql
SELECT * FROM public.smartcity_indicadores_regiao ORDER BY regiao;

SELECT execucao_id, inicio, publicado_em, motor, bairros, ocorrencias, lotes
FROM public.smartcity_pipeline_execucoes
ORDER BY publicado_em DESC LIMIT 5;

SELECT COUNT(*) AS total, COUNT(DISTINCT id_denuncia) AS ids_unicos
FROM public.smartcity_ocorrencias;

SELECT COUNT(*) AS total, COUNT(DISTINCT codigo_bairro) AS bairros_unicos
FROM public.smartcity_ibge_bairros;
```

Execute duas vezes, compare as contagens e os lotes; em seguida, altere uma
ocorrência de teste pelo app e rode outra carga. Se a fonte mudou entre duas
execuções, é correto que haja um novo lote e contagens diferentes. Veja o
roteiro em [docs/roteiro-apresentacao.md](docs/roteiro-apresentacao.md).

## Testes e estado de validação

```bash
python -m unittest discover -s tests -v
```

Os testes usam dados sintéticos, sem credenciais ou chamadas aos bancos reais.
Verificam contratos e qualidade, datas UTC, hashes, parâmetros das consultas e,
quando o PostgreSQL local está disponível, executam as views em um cluster
temporário sem rede. O teste de paridade Spark/Pandas requer PySpark e Java.

Na validação desta alteração: **15 testes passaram e 1 foi ignorado por falta
de PySpark**. As views foram executadas no PostgreSQL 16 local. A carga com
MongoDB/Neon e ocorrências reais **ainda precisa ser validada**: falta configurar
`SMARTCITY_DATABASE_URL`, e este ambiente está sem acesso de rede para instalar
PySpark ou alcançar os serviços. Não há publicação real nem agenda ativada
comprovadas por esses testes locais.

## Servidor MCP e exercícios da aula 10

Permanecem os arquivos `banco.py`, `assistente.py`, `servidor.py` e
`cliente_teste.py`. O MCP inclui:

| Ferramenta | Resultado |
| --- | --- |
| `indicadores_smartcity(regiao=None)` | Ocorrências regionais e contexto municipal IBGE, com nota territorial |
| `auditoria_pipeline()` | Últimas 20 publicações, lotes, motor e contagens |
| `listar_tabelas()` | Tabelas e views no schema `public` |
| `descrever_tabela(tabela)` | Colunas e tipos |
| `executar_select(sql)` | SELECT somente leitura, até 10 linhas |
| `contar_linhas(tabela)` | Contagem integral como `int` |
| `perguntar_ao_banco(pergunta)` | SQL, resultado e explicação em português; requer provedor de IA |

`BancoComLimite(BancoNeon)` mantém a herança e devolve até 10 resultados;
contagens e agregações consideram toda a tabela. O modelo vem de `MODELO`,
com `gpt-6-luna` como padrão do exercício; esse nome precisa existir no provedor
utilizado. `GPT`/`OPENAI_API_KEY` e `BASE_URL`/`OPENAI_BASE_URL` são opcionais
para as ferramentas determinísticas e para o dashboard.

```bash
fastmcp dev inspector servidor.py
python cliente_teste.py --pergunta "Quantas ocorrências de saneamento estão pendentes em cada região?"
```

Para um cliente stdio, configure o caminho absoluto do Python da sua `.venv`
como `command` e o caminho de `servidor.py` em `args`. O servidor localiza o
`.env` pela pasta do projeto. `python servidor.py` aguarda um cliente MCP pela
entrada padrão e não abre uma página web.

A tabela antiga `recife_populacao_saneamento` permanece no banco se já existia.
O produto integrado usa os novos objetos `smartcity_*`; a nova pipeline não
apaga nem atualiza a tabela antiga.

## Camada de alagamentos do SmartCity

Para subir o ETL no mesmo Compose do backend, consulte o [guia de implantação](../backend/DADOS.md).

A camada `Base de Pontos Alagamentos - EMLURB` do ESIG Recife fornece pontos
cadastrados, bairro e RPA. A camada no aplicativo representa a concentração
desses pontos. A fonte não fornece frequência de eventos nem alertas ao vivo.

A carga de alagamentos roda separadamente da carga de IBGE e ocorrências.
Reutiliza `MONGODB_URI` e `DATABASE_URL` (Neon) e não precisa da conexão ao
banco operacional. O fluxo confirma que recebeu todos os IDs pedidos antes de
gravar as feições GeoJSON na bronze, relê o lote com verificação de integridade
e usa Spark para validar as coordenadas. A chave `(fonte, id_externo)` impede
duplicatas no Neon. A publicação é transacional.

```bash
python run_etl.py --dataset alagamentos --engine spark
# Com o Prefect configurado, servir o deployment no horário de PIPELINE_CRON:
python run_etl.py --dataset alagamentos --serve --engine spark
```

```sql
SELECT fonte, lote, pontos, publicado_em FROM public.smartcity_alagamentos_publicacao;
SELECT bairro_chave, COUNT(*) FROM public.smartcity_pontos_alagamento
GROUP BY bairro_chave ORDER BY COUNT(*) DESC;
```

Configure `ANALYTICS_DATABASE_URL` no serviço de demandas para apontar ao
mesmo Neon, com credenciais de leitura da tabela `smartcity_pontos_alagamento`.
O app Android usa a rota autenticada `GET /demands/analytics/flood-points`
do gateway existente. No mapa, o botão **Alagamentos** inicia a consulta e o
filtro por bairro recorta os pontos sem enviar o GPS ao servidor.

O Expo Go permite testar a renderização nativa do mapa no Android. Para
validar também o login Keycloak e executar o fluxo integrado com a sessão
real, use um build Expo para Android com o esquema de retorno do SmartCity.
