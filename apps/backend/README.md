# SmartCitys — API

Backend Express/TypeScript com PostgreSQL/Prisma, Redis e identidade Keycloak. O Gateway encaminha `/demands` para `/demandas` no Demand Service e `/metrics` para o Metrics Service.

## Executar no Linux

Requisitos: Node.js 22 LTS, npm e Docker com containers Linux. Execute na raiz do repositório:

```bash
npm ci
npm run team:backend -- up
curl http://127.0.0.1:8080/health
```

O atalho cria `apps/backend/.env.team.local` com senhas locais, inicia PostgreSQL e Redis, aplica migrations e inicia os três serviços. Não copie a senha do RDS. No Windows/PowerShell, use `npm.cmd` e `curl.exe`.

```bash
npm run team:backend -- logs
npm run team:backend -- migrate
npm run team:backend -- test
npm run team:backend -- down
```

`down` preserva os volumes. Preserve também o arquivo de senhas enquanto os volumes existirem. Depois de trocar de branch ou dependências, execute `up` novamente. O [guia da equipe](../../docs/team-development.md) detalha a operação.

## Banco de dados

| Ambiente | PostgreSQL no host | Banco | Schema |
|---|---|---|---|
| Desenvolvimento | `127.0.0.1:5433` | `smartcitys_dev` | `demand` |
| Testes | `127.0.0.1:5434` | `smartcitys_test` | `demand` |

O Compose inicializa o schema por `dev/init-schema.sql`. Demand mantém as migrations em `demand-service/prisma/migrations`; Metrics usa um modelo de leitura compatível. Em uma instalação PostgreSQL manual, crie o schema `demand` antes de aplicar as migrations. Não use `db push` nem edite migrations já aplicadas.

```bash
npm run team:backend -- migration nome_da_mudanca
npm run team:backend -- migrate
npm run team:backend -- test
```

## Variáveis de ambiente

O caminho recomendado usa `compose.team.yml` e o atalho, que já fornecem as variáveis de cada serviço. `.env.example` é referência para execução manual, não contém credenciais do ambiente compartilhado e não é carregado automaticamente pelo atalho.

| Variável | Consumidor | Finalidade |
|---|---|---|
| `DATABASE_URL` | Demand/Prisma | PostgreSQL com `?schema=demand` |
| `DATABASE_URL_DEMAND` | Metrics/Prisma | Leitura do mesmo banco/schema |
| `DATABASE_URL_ETL` | Metrics/Prisma, opcional | SELECT da camada prata IBGE/geografia/SGB; ausência não impede bootstrap |
| `TEST_DATABASE_URL` | Testes Demand | Banco exclusivo; a suíte cria e remove dados |
| `REDIS_URL` | Demand e Metrics | Cache/eventos; testes usam Redis separado |
| `KEYCLOAK_ISSUER` | Demand e Metrics | URL exata do realm que emite os tokens |
| `KEYCLOAK_AUDIENCE` | Demand e Metrics | Audience esperada no access token |
| `PORT` | Cada serviço | Gateway 8080, Demand 3002, Metrics 3003 |
| `DEMAND_SERVICE_URL` | Gateway | URL interna do Demand |
| `METRICS_SERVICE_URL` | Gateway | URL interna do Metrics |
| `TRUSTED_PROXY_ADDRESS` | Gateway | IP exato do proxy HTTPS confiável; omitir no acesso local direto |
| `EXPO_PUSH_ACCESS_TOKEN` | Demand | Credencial privada de envio, somente no servidor de integração |

O backend local mantém `EXPO_PUSH_ACCESS_TOKEN` vazio. Push real exige o ambiente de integração configurado pelo responsável. Não coloque tokens, senhas, credenciais Firebase Admin ou arquivos de assinatura no Git.

## Autenticação

Cadastro, login e recuperação de senha pertencem ao Keycloak. O app usa Authorization Code com PKCE e não tem `client_secret`. Esta API não oferece `/auth/login` nem `/auth/register`.

Rotas protegidas recebem `Authorization: Bearer <access_token>`. O servidor valida assinatura, issuer, audience, validade e papéis. `cidadao` e `gestor` usam as funções de ocorrência própria; as rotas `/gestor`, KPIs e indicadores brutos exigem `gestor`. O resumo agregado Dashboard e a camada SGB permitem `cidadao` ou `gestor`, sem expor dados individuais. Ocultar uma aba no app não substitui essa autorização.

## Documentação de endpoints

O contrato importável está em [OpenAPI 3.0.3](../../docs/api/openapi.json). Importe esse arquivo no Postman ou Insomnia, ou abra no Swagger Editor. Selecione o servidor local e forneça um access token da sua conta. Não salve o token na especificação nem em coleções versionadas.

| Método | Rota externa | Acesso |
|---|---|---|
| GET | `/ping`, `/warmup`, `/health` | Sem autenticação |
| POST | `/demands` | Cidadão ou gestor |
| GET | `/demands/my-demands`, `/demands/feed` | Cidadão ou gestor |
| GET, PATCH, DELETE | `/demands/{id}` | Proprietário |
| GET | `/demands/gestor`, `/demands/gestor/{id}` | Gestor |
| PATCH | `/demands/gestor/{id}/status` | Gestor |
| PATCH | `/demands/gestor/{id}/prioridade` | Gestor |
| PUT, DELETE | `/demands/devices/push` | Aparelho do usuário autenticado |
| GET | `/metrics` | Gestor |
| POST | `/metrics/refresh` | Gestor |
| GET | `/metrics/dashboard`, `/metrics/inundation` | Cidadão ou gestor |
| GET | `/metrics/indicators/neighborhoods` | Gestor |

As listagens aceitam `page` (padrão 1) e `limit` (padrão 20, máximo 100), retornando `data` e `pagination`. O servidor ainda não aplica `search`, `status` ou filtros avançados. A lista do cidadão no app percorre as páginas e filtra localmente. O feed do mapa continua limitado aos 100 registros mais recentes.

Criação exige título (até 50 caracteres), categoria, região, descrição e endereço ou par de coordenadas. O fluxo Android envia foto como data URI JPEG/base64 em `imagens`; o corpo completo é limitado a 5 MB. Fotos ficam no PostgreSQL como texto, sem S3. `PATCH /demands/{id}` exige os mesmos campos do cadastro e substitui as fotos. Apenas ocorrências próprias em `ABERTA` podem ser editadas/excluídas.

A alteração de status grava histórico e tenta enviar push. Uma resposta HTTP de sucesso confirma a alteração persistida, mas não comprova a entrega da notificação ao Android.

## Testes

Use `npm run team:backend -- test`, que aplica migrations e executa Vitest com banco e Redis exclusivos. Não execute a suíte no RDS ou em banco com dados pessoais. [Detalhes dos testes](demand-service/README-TEST.md).

## Integração opcional IBGE e SGB

Dashboard e inundação leem somente dados tratados na camada prata da ETL, via
`DATABASE_URL_ETL` com permissão SELECT. Não consultam APIs públicas no app ou na
requisição HTTP. MongoDB bronze, Spark, cargas idempotentes e Prefect pertencem à
pipeline, executada antes do produto consultar o banco. A ausência da conexão ou
carga retorna 503 nas rotas novas; o CRUD, health e KPIs continuam funcionando.
Não há fallback para dados sintéticos nem dependência de Expo Go.

O Compose local aceita `DATABASE_URL_ETL` opcional pelo ambiente ou pelo arquivo
local ignorado usado por `team:backend`, sem substituir as senhas locais. A suíte
`team:backend -- test` mantém os testes Demand em banco/cache exclusivos e executa
os testes Metrics com persistência simulada e a conexão ETL vazia. Conectividade
real com Neon e a jornada Android exigem validação separada com conta própria.
Veja [contratos, configuração e limites dos indicadores](metrics-service/README.md).
