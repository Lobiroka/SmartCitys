# Integração das telas SmartCity na main

Base: `62aaa91`. Alterações em branch local de integração.
Este registro separa a validação da main das funcionalidades propostas. As alterações mobile, backend e autenticação foram aplicadas para revisão nesta
branch local após a validação da base. Não houve publicação nem merge remoto.

## Escopo e contratos preservados

A integração adapta as telas do checkout antigo à main, arquivo por arquivo.
Mantém Expo SDK 57, APK development/preview, pacote
`com.darkartsbm.smartcitys`, versão 1.0.1 e scheme `wb`. O destino não usa Expo Go,
servidor de demonstração, dados locais simulados ou login alternativo. Não copia
o `preview`, dependências SDK 58, configurações nativas ou lockfile antigos.

Permanecem MVVM, Keycloak com Authorization Code/PKCE, SecureStore e o mesmo
`AuthenticatedFetchHttpClient`. A API continua validando assinatura, issuer,
audience e papéis. A proteção visual de Gestão não substitui a autorização no
backend. São preservados paginação completa da lista, controle da câmera,
permissões, temas e identificadores Maestro, incluindo `login-button`,
`register-button`, `tab-home`, `tab-occurrences`, `tab-manager`,
`occurrence-create-button`, `occurrence-coordinates` e `main-map-loaded`.

| Tela/rota | Acesso e comportamento | Integração HTTP |
|---|---|---|
| `(auth)/login` e `wb://auth/callback` | Login real, cadastro, cancelamento e retorno ao APK | OIDC/Keycloak; nenhuma senha no backend do app |
| `(tabs)/index` — Home | Mapa nativo, localização, perfil/logout, camada SGB e visão de Recife | Feed existente e `GET /metrics/inundation` |
| `(tabs)/dashboard` — Dashboard | Nova aba entre Home e Ocorrências; sessão obrigatória | `GET /metrics/dashboard` |
| `(tabs)/explore` — Ocorrências | Lista, pesquisa e filtros; botão `+` abre o formulário existente; mapa para registros com coordenadas | Contratos `/demands` existentes e camada SGB compartilhada pela lista |
| `(tabs)/create-occurrence` e `edit-occurrence` | Mesmo formulário, foto/GPS e persistência; mapa acompanha coordenadas disponíveis | CRUD `/demands` existente |
| `(tabs)/gestor` e `gestor/[id]` | Rotas/telas da main, restritas ao gestor | Endpoints administrativos existentes |

`appDependencies.ts` conecta os novos serviços ao cliente autenticado existente.
A autenticação compartilha a renovação entre chamadas simultâneas e
restauração, permite nova tentativa após falha e aguarda refresh em andamento
antes de revogar/limpar no logout. Não muda PKCE, armazenamento ou política de 401.

## Dados públicos e pipeline

A pipeline Python está versionada em [pipelines/recife](../pipelines/recife/README.md),
adaptada do projeto `ETL-Data-Orchestration`. Contém
`orchestrate_prefect.py`, `orchestrate_inundation.py`, `run_etl.py` e
`serve_etl.py`. O fluxo é:

**APIs públicas IBGE/SGB → MongoDB bronze → Spark → PostgreSQL/Neon prata →
Metrics/Gateway → app Android.**

Snapshots bronze, identificadores e upserts evitam duplicação em reexecuções.
A transformação valida contagens, códigos e geometrias; publicação transacional
preserva a versão anterior em caso de falha. Prefect define tarefas, tentativas
e o agendamento de `serve_etl.py`, configurado por `ETL_CRON`/`ETL_TIMEZONE`.
A existência do código de agendamento não comprova um runner ativo em produção.
Credenciais ficam fora do código, em configuração externa centralizada; não são
enviadas ao aplicativo nem registradas nas evidências.

Metrics consulta `recife_populacao_saneamento`, `recife_bairros_limites` e
`recife_inundacao_sgb` por uma conexão `DATABASE_URL_ETL`, separada de
`DATABASE_URL_DEMAND`, com permissão SELECT. Não executa ETL na requisição.
A conexão é criada sob demanda; sem carga/configuração disponível, as rotas novas
retornam 503 sem impedir login, mapa base, CRUD ou KPIs existentes.

O Dashboard agrega ocorrências e relaciona coordenadas a bairros por ponto em
polígono. Endereço livre não determina bairro. Registros sem coordenadas, fora
da cobertura ou em bordas ambíguas são contabilizados separadamente. O retorno
não inclui identidade, fotos ou descrições individuais. Os indicadores IBGE
iniciais são do Censo 2010; valores ausentes não são convertidos em zero.

A camada SGB representa **suscetibilidade histórica à inundação**, com classes
Baixa/Média/Alta e referência inicial de 2014: não é alerta atual nem ocorrência
de alagamento observada. Ausência de polígono não significa risco baixo. A
consulta inicial da ETL retornou 422 polígonos; esse número descreve aquela coleta,
não uma contagem fixa exigida no app. Mapas mantêm ano/origem e continuam
utilizáveis se a camada falhar.

## Evidências e pendências

Validação informada pelo executor principal em 23/11/2026, antes das novas telas:

| Verificação da main | Resultado confirmado |
|---|---|
| Mobile | 87 testes em 20 suítes aprovados na repetição; primeira execução teve timeout de 10 s em RootNavigator, sem alteração/desativação do teste |
| Análise estática | Lint e TypeScript aprovados |
| Backend local | Check e testes aprovados: 39 passaram, 6 ignorados pela suíte existente, 6 suítes e 7 migrations locais |
| Ambiente Android | Samsung SM-T220, Android 14, APK development 1.0.1, código 2; Metro SDK 57 |
| Login real | Keycloak autenticou e retornou por `wb://auth/callback` à Home; cancelar voltou ao login; reiniciar o APK restaurou a sessão |
| Mapa/localização | Mapa nativo e localização real funcionando; coordenadas pessoais não são publicadas |

A inicialização do Metro precisou de ajuste na configuração de ambiente antes
de integrar telas: o arquivo `.env.team.local` estava sendo tratado como código
JavaScript. Essa falha de inicialização não foi causada pelo Dashboard. O APK e
seus identificadores foram preservados. A API compartilhada foi consultada em
modo de leitura; o ensaio de escrita usa a API local em `127.0.0.1:8080` via ADB.

O baseline no tablet também confirmou criação com GPS, edição com foto capturada
pela câmera e exclusão do registro temporário no banco local. O identificador
`main-map-loaded` foi observado. O fluxo Maestro de cadastro concluiu todas as
etapas registradas; seu processo terminou com código 143, sem relatório final de
sucesso. O cadastro foi confirmado diretamente no banco e na interface.

## Validação após integração

- A suíte mobile final passou com **114 testes e 30 suítes**, na primeira
  execução após o último ajuste. Lint e TypeScript passaram. Um teste reproduziu
  o erro de recuperação do GPS após “Ver Recife” antes da correção e passou
  depois, preservando os callbacks e identificadores do mapa.
- Backend: 39 testes Demand aprovados, 6 ignorados preexistentes e 19 testes
  Metrics aprovados. Os builds TypeScript de Demand, Metrics e Gateway passaram;
  health final retornou saudável.
- No APK integrado, o login com a conta genérica retornou à Home com as três
  abas. Sem ETL, Dashboard e SGB exibiram nova tentativa; após ativar a conexão
  de leitura local, Dashboard exibiu os 94 bairros e o mapa desenhou polígonos
  reais do SGB com classes e referência 2014.
- Dois flows Prefect completos extraíram APIs reais, gravaram cinco snapshots
  bronze autenticados no Mongo e publicaram 94 indicadores, 94 limites e 422
  áreas SGB no PostgreSQL local. A segunda execução preservou os hashes,
  contagens e chaves únicas de todas as tabelas. Reader: SELECT aprovado e
  INSERT recusado com SQLSTATE 42501; Mongo sem autenticação recusou leitura.
- O `serve_etl.py` registrou o deployment `recife-diario` em servidor Prefect
  local: cron `0 3 * * *`, fuso `America/Recife`, limites local/global de uma
  execução. Após prontidão do Runner e SIGINT, a API confirmou a agenda pausada.
  O ensaio manteve os serviços de disparo desativados e registrou zero flow runs;
  comprova registro e encerramento, sem comprovar um disparo futuro às 3h.
  Runner e servidor temporários foram encerrados ao final.
- A porta padrão do script Android continua 8081. `SMARTCITYS_METRO_PORT=8083`
  permite testar outro checkout sem encerrar o Metro existente; entradas
  inválidas e conflito com a API local 8080 foram verificados por `--check`.

O teste Android integrado confirmou cadastro com GPS, mapa no formulário, foto
capturada e mapa na lista. A fase final Maestro terminou com código 0; o banco
local confirmou um registro com coordenadas e uma imagem. A primeira tentativa
de rolagem da automação arrastou o mapa interativo; os fluxos passaram a rolar
pela margem, mantendo as verificações de foto/GPS; os dois arquivos alterados
passaram na validação de sintaxe Maestro. O registro fictício local
ficou disponível para revisão. Após reiniciar pelo script oficial da equipe na porta 8083, a sessão
foi restaurada, as três abas apareceram e a camada SGB foi carregada novamente. A jornada completa de gestor/push exige
condições adicionais e não foi comprovada por este único tablet.

O recorte versionado da pipeline tem 13 testes unitários/Spark aprovados e uma
integração opt-in ignorada nesta suíte. Seus 16 arquivos Python coincidem com os
utilizados nas duas cargas reais; não inclui exports, credenciais ou prévia.

As cargas desta validação usaram **PostgreSQL local**, não o Neon de produção.
A implementação aceita Neon por `DATABASE_URL` na ETL e `DATABASE_URL_ETL` no
Metrics. Ativação em nuvem requer a conexão SELECT autorizada e implantação do
serviço/runner pelo responsável. `serve_etl.py` define o cron; nenhum runner ou
agendamento permanente foi publicado durante este ensaio. Credenciais locais
foram mantidas fora do repositório em arquivos restritos; não constam deste
registro ou dos contratos públicos.

## Revisão e aplicação do merge

As alterações estão na branch local de integração, sem commit
ou push. O patch completo `smartcity-merge.patch`, entregue ao lado da pasta
`main`, inclui arquivos novos e foi validado contra a base `62aaa91`, sem mexer
no índice normal do repositório. Aplique somente em um checkout limpo da base:

```bash
git switch -c feature/revisar-smartcity
git apply --check /caminho/smartcity-merge.patch
git apply /caminho/smartcity-merge.patch
npm ci
npm run mobile:test
npm run mobile:lint
npm run team:backend -- test
```

Se a main remota avançar, revise os conflitos antes de integrar. Configurações
locais, a conta de teste e conexões privadas não acompanham o patch. O responsável
continua revisando a contribuição e ativando backend/Neon/distribuição pelo
fluxo já documentado; o patch não publica APK ou infraestrutura.

## Retorno local à base

Preserve a branch, o diff e os arquivos novos antes de trocar de código. Se a
integração precisar ser interrompida, carregue a base `62aaa91` em outro checkout
ou retorne à branch da base após salvar o trabalho. Reinicie somente o Metro e a
stack local correspondentes ao checkout escolhido; mantenha as portas e sessões
de outros projetos. Não use `reset --hard`, `clean`, limpeza do APK/Chrome,
exclusão de volumes ou reset de banco como rollback.

A proposta não altera o schema de ocorrências. A base pode usar seus mesmos dados
locais; preserve o arquivo de configuração local junto aos volumes. Para
desativar apenas a consulta ETL, remova sua variável do ambiente local do Metrics
e recrie esse serviço, mantendo Demand e dados. Não há rollback em RDS, Neon ou
infraestrutura compartilhada autorizado por este procedimento.
