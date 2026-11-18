# ETL de alagamentos com o Docker Compose do SmartCity

O `demand-service` continua atendendo às ocorrências no gateway existente.
A rota autenticada `GET /demands/analytics/flood-points` lê o Neon. O executor
do Prefect roda a carga da Prefeitura em seu próprio contêiner e escreve no
Neon. Tanto o executor como o servidor Prefect reiniciam com o Docker, salvo
se forem parados manualmente. O painel do Prefect fica disponível na porta
4200 do próprio servidor e o histórico fica no volume `prefect-data`.

## Atualizar uma VPS que já roda o SmartCity

Depois de subir o commit, atualize o checkout da VPS para a branch que contém
a integração. Durante os testes, use `teste-mapa-de-calor`; depois da aprovação,
use a branch que a equipe publica. Confira se há mudanças locais no servidor
antes de trocar de branch. O checkout atualizado deve conter `apps/backend/`
e `apps/etl/`.

Na raiz do checkout da VPS, depois de conferir o `git status --short`:

```bash
git fetch origin
git switch teste-mapa-de-calor
git pull --ff-only origin teste-mapa-de-calor
```

Edite o `apps/backend/.env.local` que a VPS já usa. Se o ETL ainda não tem
arquivo de ambiente, copie `apps/etl/.env.example` para `apps/etl/.env`
e preencha as conexões. Os arquivos com credenciais ficam na VPS.

| Arquivo | Variáveis para a integração |
| --- | --- |
| `apps/backend/.env.local` | Adicione `ANALYTICS_DATABASE_URL` com uma conexão de leitura para o Neon. Preserve as variáveis do backend, incluindo `DATABASE_URL_DEMAND`. |
| `apps/etl/.env` | Preencha `MONGODB_URI` para o MongoDB e `DATABASE_URL` com a conexão de escrita para o mesmo Neon. `PIPELINE_CRON` é opcional, com padrão de 06h no horário de Recife. |

Da pasta `SmartCitys/apps/backend`, usando Bash:

```bash
compose=(docker compose --env-file .env.local -f docker-compose.yml -f compose.data.yml)
"${compose[@]}" config --quiet
"${compose[@]}" ps
```

O `ps` deve mostrar os contêineres do SmartCity que já estão no ar. Se a VPS
usa um nome de projeto Compose específico (`-p` ou `COMPOSE_PROJECT_NAME`),
um arquivo de ambiente diferente ou outro arquivo Compose, mantenha essas
opções e acrescente `-f compose.data.yml` por último. Assim você atualiza o
projeto existente. Em seguida, atualize o serviço de demandas e inicie os
componentes de dados:

```bash
"${compose[@]}" up -d --build demand-service prefect-server etl-alagamentos
"${compose[@]}" ps
```

O `demand-service` pode ficar brevemente indisponível enquanto o Compose
recria seu contêiner. O gateway continua usando a mesma URL pública.

O agendamento começa quando o executor registra a rotina. Para popular o
mapa imediatamente, enfileire a primeira execução no Prefect e acompanhe o log:

```bash
"${compose[@]}" exec etl-alagamentos prefect deployment run 'SmartCity - pontos de alagamento/smartcity-alagamentos'
"${compose[@]}" logs -f --tail=80 etl-alagamentos
```

Se o comando ainda não encontrar a rotina, confira `ps` e o log do executor.
A interface do Prefect, na própria máquina que roda o Docker, está em
[http://127.0.0.1:4200](http://127.0.0.1:4200).

Se você também quiser agendar os indicadores do IBGE e a leitura das
ocorrências, configure `SMARTCITY_DATABASE_URL` no ambiente do ETL com acesso
de leitura ao banco operacional. Em seguida, inicie o executor opcional:

```bash
"${compose[@]}" --profile dados-ibge up -d --build etl-integrado
```

Confira o fim da carga no Prefect, consulte a contagem no Neon e abra
**Alagamentos** na versão Android que contém a integração.

```sql
SELECT pontos, publicado_em
FROM public.smartcity_alagamentos_publicacao
WHERE fonte = 'esig_emlurb_recife';
```

Se uma carga da Prefeitura falhar, o aplicativo
continua lendo o último lote publicado. O backend pode ser iniciado com o
`docker-compose.yml` sozinho quando for rodar apenas o fluxo operacional.
