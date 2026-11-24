# Metrics: KPIs, Dashboard e camada SGB

Os KPIs existentes continuam usando `DATABASE_URL_DEMAND`, Redis e os controles
`authMiddleware` + `gestor`. O Dashboard e a camada de inundação são integrações
adicionais e opcionais. Não há alteração no CRUD, no login ou no schema Demand.

## Origem e contrato

O fluxo de dados públicos é **API pública → MongoDB bronze → Spark → PostgreSQL
Neon prata → Metrics/Gateway → app Android**. O Prefect agenda e orquestra as
cargas idempotentes no projeto ETL; as credenciais ficam em configuração externa.
Este serviço apenas lê os bancos: não extrai APIs públicas nem executa cargas ou
migrations durante uma requisição.

| GET pelo Gateway | Acesso | Conteúdo |
|---|---|---|
| `/metrics` | Gestor | KPIs existentes, com cache Redis |
| `/metrics/dashboard` | Cidadão ou gestor | Contagens por bairro cruzadas com os indicadores IBGE |
| `/metrics/inundation` | Cidadão ou gestor | Polígonos e classes históricas de suscetibilidade do SGB |
| `/metrics/indicators/neighborhoods` | Gestor | Indicadores tratados; filtro `codigoBairro` opcional |

`POST /metrics/refresh` permanece exclusivo do gestor. Todas essas rotas usam o
token Keycloak existente, validando assinatura e papéis no servidor. O contrato
completo está em `docs/api/openapi.json`. Nenhuma rota anônima ou servidor de
prévia acompanha esta integração.

## Ativação opcional da ETL

A ETL deve concluir a carga das tabelas abaixo antes de habilitar suas telas:

- `public.recife_populacao_saneamento`: código/nome do bairro, população,
  domicílios, percentual de rede de esgoto, ano e data de extração;
- `public.recife_bairros_limites`: código do bairro, geometria GeoJSON WGS84 e
  data de extração;
- `public.recife_inundacao_sgb`: ID, classe, ano, descrição da fonte, geometria,
  bbox, origem e data de extração.

Configure `DATABASE_URL_ETL` somente no Metrics com uma credencial **SELECT**
para essas três tabelas. Não substitua `DATABASE_URL_DEMAND` nem reutilize a
credencial de escrita da ETL. O administrador do banco fornece/autoriza essa
conexão; não é necessário compartilhar credenciais AWS, RDS ou Firebase Admin.

No ambiente local da equipe, exporte `DATABASE_URL_ETL` no processo que executa
`npm run team:backend -- up`, ou acrescente a variável ao arquivo local ignorado
`apps/backend/.env.team.local`, preservando as senhas locais existentes. Não
imprima ou versione esse arquivo. Execute `up` novamente para recriar o Metrics
com a configuração atual. O Compose encaminha a variável somente ao Metrics e
aceita sua ausência. Para execução manual de `npm run dev`, forneça as variáveis
do serviço no ambiente; `.env.team.local` não é carregado automaticamente pelo
`dotenv/config`.

Sem a conexão ETL, com conexão inválida ou com carga necessária indisponível,
as novas rotas retornam HTTP **503** e mensagem segura. Não fabricam registros,
não retornam demonstrações e não fazem fallback para a API pública. Bootstrap,
health check, CRUD e KPIs continuam independentes da ETL. Remover a variável e
reiniciar o serviço desativa somente essa integração.

A conexão ETL é criada na primeira consulta; pool de duas conexões, conexão e
espera de cinco segundos, transação de seis segundos e SQL limitado a quatro
segundos. Repositórios executam `SET TRANSACTION READ ONLY`. O filtro de bairro
usa parâmetro SQL, preservando zeros iniciais e aceitando apenas 1 a 20 dígitos.
Código inexistente retorna lista vazia; ausência de indicadores ou limites
completos torna o Dashboard indisponível.

## Interpretação no produto

O Dashboard lê **todas** as ocorrências do Demand, não apenas a primeira página
do feed. Busca somente categoria, status e coordenadas, sem retornar detalhes
individuais, fotos, identidade, títulos ou descrições. O vínculo com bairro é
calculado por ponto em polígono; endereço livre não é usado para adivinhar bairro.
Casos sem coordenadas, fora da cobertura e nas bordas ambíguas são contados
separadamente. Buracos e multipolígonos são respeitados.

Valores ausentes permanecem `null`, distintos de zero. `ano` informa a referência
histórica e `dataExtracao` informa quando a fonte foi coletada. O recorte inicial
IBGE usa o Censo 2010; a razão por 10 mil habitantes não representa incidência
atual nem demonstra causa entre saneamento e ocorrências.

A camada SGB informa suscetibilidade Baixa/Média/Alta com o ano fornecido pela
ETL. O recorte inicial consultado era de 2014. Não representa alagamentos agora,
alertas ou monitoramento em tempo real. Sua falha deve ser apresentada no app
sem bloquear o mapa ou o formulário. O app Android mantém seu APK development
ou preview; esta integração não depende de Expo Go.

## Validação local

Na raiz, `npm run team:backend -- test` executa os testes Demand no PostgreSQL e
Redis exclusivos e os testes Metrics sem serviços externos. Em Metrics, `npm ci`,
`npm run prisma:generate` e `npm test` geram o cliente compatível com o schema
existente, compilam e executam a suíte. Não foi adicionado modelo ETL ao schema
Prisma Demand: tabelas prata são acessadas por SQL qualificado e leitura.

Os testes Metrics substituem apenas identidade/persistência e cobrem contratos,
401/403, acesso cidadão/gestor, manutenção dos KPIs, SQL parametrizado, transações
de leitura, erros 503 seguros e cruzamento espacial. Não comprovam conectividade
Neon ou o login real. O serviço `metrics-tests` não recebe `DATABASE_URL_ETL`.

Depois dos testes, valide com conta própria no Android via `npm run
team:android:local`, API local e **dados reais já carregados pela ETL** em um banco
de integração autorizado. Confira ano, origem, classes e contagens. Testar o
CRUD sem ETL e testar as rotas novas sem variável configurada deve manter os
fluxos anteriores funcionando. Não apontar testes de banco para RDS e não
alterar infraestrutura, permissões ou banco compartilhado para esse ensaio.
