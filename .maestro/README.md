# Teste E2E do MVP

## Jornada completa da entrega final

`npm.cmd run mobile:test:e2e:final -- --citizen-device emulator-5554 --manager-device emulator-5556`
executa os três roteiros em `final/`, em sequência, sem atalhos de criação ou atualização por API:

1. cadastra um cidadão novo no formulário real do Keycloak, sai e entra novamente;
2. confirma ausência de Gestão, valida campos obrigatórios e registra ocorrência com GPS e foto da câmera;
3. pesquisa, alterna filtros e reabre o registro para conferir foto e GPS persistidos;
4. em outro Android, autentica o gestor, confere o mesmo registro, foto e GPS e muda o status pela tela;
5. no Android do cidadão, exige o push real na bandeja e confere o novo status e os filtros.

Antes das capturas de cadastro e login, aguarda o evento nativo `onMapLoaded`
(tiles renderizados), a localização resolvida e o fim da movimentação da câmera,
por até 90 segundos. Em seguida aguarda a estabilização visual da tela. Mostrar o
menu do perfil ou emitir `onMapReady` não basta para liberar essas capturas.
Essa exigência pertence à jornada final com serviços reais, sem ser adicionada
ao fluxo básico da regressão isolada.

Em emuladores, mantenha o GPS virtual atualizado durante o ensaio. Uma única
posição enviada antes do cadastro pode ficar antiga quando o formulário pedir
uma posição de alta precisão. Em outro terminal PowerShell, com o SDK no PATH:

```powershell
while ($true) {
  adb -s emulator-5554 emu geo fix -34.877 -8.0476
  Start-Sleep -Seconds 3
}
```

Essas coordenadas são dados fictícios de preparação do emulador. O aplicativo
continua obtendo a posição pelo serviço nativo do Android. Encerre esse terminal
ao terminar o teste; não use esse comando com um aparelho físico.

São necessários **dois dispositivos distintos e exclusivos de testes**, com o mesmo APK da branch,
Maestro e ADB no PATH, Python 3.10 ou superior, internet e API/Keycloak de testes com push
configurado. O executor usa somente a biblioteca padrão do Python. O roteiro limpa
os dados do app **e do Chrome** nesses dois dispositivos, removendo sessões SSO antigas.
Não use um celular ou navegador com dados pessoais a preservar.
Em emuladores, configure uma localização válida antes da execução. Para development, mantenha
o Metro na porta 8081 e acrescente `--dev-client`; o executor prepara o encaminhamento ADB.
Esse teste não valida um APK final quando executado com Metro.
O atalho `team:android` exige apenas um Android conectado: inicie-o com o aparelho
do cidadão e abra/conecte o segundo Android depois, mantendo o Metro em execução.
Não execute esse atalho novamente com os dois conectados.

Configure `E2E_MANAGER_USERNAME` e `E2E_MANAGER_PASSWORD` no ambiente do processo,
ou acrescente `--credentials-file CAMINHO_LOCAL` apontando para JSON local ignorado pelo Git
com essas duas propriedades. Não passe senhas na linha de comando nem as versione.
O cidadão e a senha são gerados em memória a cada execução; o realm precisa permitir cadastro
e atribuir apenas `cidadao` por padrão. Não são necessárias credenciais administrativas.

O teste cria conta e ocorrência fictícias no ambiente compartilhado e envia notificação real.
Não altera infraestrutura nem remove dados automaticamente. O responsável pode localizar os
dados pelo identificador da execução. Por depender de push e de dois Androids, esta jornada é
uma execução explícita de integração; não substitui nem passa a fazer parte automaticamente
da regressão diária isolada.

O resultado fica em `test-results/e2e/final-<id>/`: `execution.json`, JUnit agregado e logs,
JUnit e screenshots por etapa. Aprovação exige as três etapas e os respectivos JUnits válidos;
erro, timeout ou relatório ausente interrompe o fluxo. Logs de texto são sanitizados; revise
visualmente screenshots antes de publicá-los. Execuções com falha também devem ser preservadas.

Os fluxos antigos reutilizam `flows/start-app.yaml`, `flows/login.yaml` e
`flows/create-occurrence.yaml`, mantendo suas validações originais.

## Jornada básica do MVP

O fluxo `mvp.yaml` valida o caminho crítico em um build próprio do aplicativo:

1. abre o app com estado limpo;
2. autentica um usuário de testes no Keycloak;
3. acessa a lista de ocorrências;
4. confirma a validação dos campos obrigatórios;
5. preenche o formulário e obtém a localização pelo GPS;
6. cria a ocorrência pelo backend;
7. confirma que ela aparece na listagem;
8. sai da sessão e reabre o app sem limpar dados, confirmando o retorno ao login (TC-03).

Após o login, o fluxo aguarda o controle acessível `Menu do Perfil` no mapa.
A opção `Sair` só aparece depois de abrir esse menu; o teste faz isso antes do logout.
Esperar `Sair` imediatamente após autenticar não corresponde à interface atual.

### Primeiro acesso do Chrome

O emulador novo pode abrir a apresentação inicial do Chrome no lugar da Custom
Tab do Keycloak. Ao dispensá-la, o navegador pode continuar no formulário ou
retornar ao aplicativo, encerrando a tentativa de autenticação. Nesse segundo
caso, o roteiro abre `Entrar` novamente uma única vez, somente dentro do ramo
que tratou a apresentação do Chrome. Ele espera por `username` ou `login-button`
antes de decidir e mantém obrigatória a espera pelo formulário Keycloak.

Isso trata um estado de preparação do navegador, não repete todo o teste nem
ignora falhas de autenticação. Sem apresentação do Chrome, esse ramo é pulado.
A falha que motivou a correção está na [execução 44722827927](https://github.com/Lobiroka/SmartCitys/actions/runs/44722827927),
acompanhada na [issue #29](https://github.com/Lobiroka/SmartCitys/issues/29).

## Pré-requisitos

- APK de desenvolvimento ou preview instalado com o application ID
  `com.darkartsbm.smartcitys`;
- Metro em execução quando for usado um development build;
- emulador ou aparelho visível em `adb devices`;
- Maestro CLI disponível no `PATH`;
- Keycloak, API e banco do ambiente de testes acessíveis pelo aparelho;
- usuário Keycloak dedicado aos testes.

Não coloque usuário nem senha no Git. Passe-os como variáveis na execução:

```powershell
maestro test `
  -e E2E_USERNAME=usuario-de-teste `
  -e E2E_PASSWORD=senha-de-teste `
  -e E2E_TITLE="Ocorrencia E2E 001" `
  .maestro/mvp.yaml
```

O mesmo fluxo pode ser iniciado pelo workspace mobile:

```powershell
npm run mobile:test:e2e -- `
  -e E2E_USERNAME=usuario-de-teste `
  -e E2E_PASSWORD=senha-de-teste `
  -e E2E_TITLE="Ocorrencia E2E 001"
```

Use um título diferente a cada execução caso o backend não limpe os dados de
teste. O fluxo é intencionalmente externo aos testes Jest: ele usa integrações
reais e, portanto, cria um registro real no ambiente apontado por `.env.local`.

## GitHub Actions

O workflow `.github/workflows/testes-api.yml` executa diariamente às 00:00 de
Fortaleza (03:00 UTC) na branch padrão, sujeito à fila do GitHub, e permite execução manual pelo menu
Actions → Regressão completa → Run workflow. Ele executa todos os testes Jest
(unitários e componentes), todos os testes de API habilitados e todo o fluxo MVP
Maestro, incluindo logout. Os filtros avançados com `it.skip` permanecem fora
do escopo definido em `documents/testes-ia.md`; aparecem como ignorados.

Configure os repository secrets `E2E_USERNAME`, `E2E_PASSWORD` e
`GOOGLE_MAPS_ANDROID_API_KEY`. O realm usado é `smartcitys-test`, em
`https://auth.darkartsbm.com`, com cliente público `smartcitys-mobile-test`,
PKCE S256, callback `wb://auth/callback` e audience `smartcitys-api-test`.
O usuário deve ter papel de realm `cidadao`, e-mail preenchido, senha não temporária
e nenhuma ação obrigatória que interrompa o login. Complete os campos exigidos
pelo perfil do realm para evitar a tela de atualização de cadastro durante o E2E.

PostgreSQL, Redis e os três serviços Node são temporários no runner. O APK é
gerado com bundle JavaScript para x86_64 e instalado no emulador Android API 34.
A API usa `http://localhost:8080` com redirecionamento ADB; somente o APK gerado
na CI recebe a permissão de HTTP para localhost. O Keycloak permanece em HTTPS.
O APK usa a assinatura de testes do template Expo; não é um build de distribuição.
Se a chave Google Maps tiver restrição de assinatura, confira se permite esse
certificado de teste. Não é necessário publicar a API de testes na internet.

Os steps de testes usam `continue-on-error` para permitir que os próximos níveis
sejam executados. O step final verifica os resultados originais (`outcome`) e
falha se qualquer nível falhar ou não executar. Os resultados do Maestro são
salvos no artefato `evidencias-e2e-<run_id>`, inclusive quando o E2E falha.

O banco é descartado ao terminar o job; o usuário e as sessões no realm de
testes continuam no Keycloak.

## E1 — registrar, acompanhar e notificar na mesma execução

O caso `registrar-acompanhar-notificar.yaml` utiliza o app Android integrado
ao backend, sem mocks de API ou de notificação. Na mesma execução:

1. Autentica o cidadão e registra uma ocorrência pelo formulário do app.
2. Localiza o registro pelo título exclusivo da execução e confirma `Aberta`
   na listagem do cidadão.
3. Confirma que a mensagem de atualização não estava presente na central de
   notificações e coloca o app em segundo plano.
4. Usa a rota real `PATCH /demands/gestor/:id/status`, com token Keycloak de
   gestor, para alterar **somente esse registro** para `EM_ANALISE`.
5. Aguarda a notificação real na central do Android. A ausência da mensagem
   em até 90 segundos reprova o caso.
6. Reabre o app, recarrega a listagem e pesquisa o mesmo título, confirmando
   `Em análise` e ausência do status `Aberta`.

O gestor atua pela API para manter o cidadão autenticado no aparelho durante
o recebimento do push. A API continua validando assinatura e papel do token;
o teste não cria papéis nem usa autenticação alternativa. O fluxo compartilha
o subfluxo de registro com o MVP em `flows/register-occurrence.yaml`.

### Preparação e execução do E1

- Um único Android autorizado conectado por ADB, com Maestro no PATH e Python.
- APK com Firebase/Expo push configurados e acesso ao backend de testes.
  Usar o código desta alteração, que identifica o status por
  `occurrence-status-<id>` para distingui-lo dos filtros da tela. Se for um
  development client, iniciar também o Metro correspondente.
- Backend de testes com envio Expo/FCM real habilitado pelo responsável.
  O Compose local padrão desativa push; a regressão atual do runner também
  não provisiona essas credenciais. Esses ambientes, sem configuração
  adicional, não comprovam o E1.
- Conta de cidadão exclusiva deste teste, sem alterações concorrentes por
  outros gestores: a mensagem atual de push é genérica, sem ID da ocorrência.
- Token de acesso Keycloak válido de **outro usuário gestor**, obtido pelo
  fluxo de login autorizado, para o mesmo ambiente do APK. Não usar token
  administrativo nem modificar o realm para executar este caso.

Na raiz, disponibilizar as variáveis no ambiente local, sem versionar ou
enviar credenciais pelo chat:

| Variável | Valor esperado |
|---|---|
| `E2E_USERNAME` | Conta dedicada do cidadão |
| `E2E_PASSWORD` | Senha da conta dedicada |
| `E2E_API_URL` | Origem da API de testes, a mesma utilizada pelo APK |
| `E2E_GESTOR_TOKEN` | Token de acesso Keycloak válido com papel gestor |

Executar:

```sh
npm run mobile:test:e2e:e1
```

Para o APK **development**, mantenha `npm.cmd run team:android` aberto em
outro terminal e execute no PowerShell:

```powershell
$env:E2E_DEV_CLIENT = '1'
npm.cmd run mobile:test:e2e:e1
```

Esse modo mantém a limpeza de dados e reabre a conexão ao Metro local na
porta 8081. Usa os parâmetros do Expo SDK 57 `disableOnboarding=1`,
`disableFab=1` e `disableAutoLaunch=1` para não exibir a apresentação inicial,
o botão flutuante de ferramentas nem o menu automático. Isso evita que o
botão do Expo cubra `Nova ocorrência`; as ações do app continuam obrigatórias.
O encaminhamento ADB é preparado pelo
comando `team:android`; o Metro precisa estar acessível em `127.0.0.1:8081`.
Em máquinas que resolvem localhost apenas para IPv6, iniciar esse comando com
`$env:NODE_OPTIONS = '--dns-result-order=ipv4first'`.

Esses parâmetros são suportados pelo cliente development atual da equipe;
no SDK 57, alteram preferências do cliente instalado. Se voltar ao uso manual,
as ferramentas podem ser reativadas nas configurações do Expo. Referência:
[execução do development client sem menu](https://github.com/expo/skills/blob/main/plugins/expo/expo-overview/references/launch-without-dev-menu.md).

Para APK independente do Metro, usar `E2E_DEV_CLIENT=0` ou remover a variável.
O padrão é `0`, preservando o fluxo da CI. As verificações da ocorrência e
do push continuam obrigatórias nos dois modos; a preparação do Expo não é
evidência de entrega de notificação. O modo utilizado fica em `execution.json`.

O runner gera título aleatório e diretório exclusivo em
`test-results/e2e/e1-<identificador>/`, contendo `results.xml` (JUnit), logs,
diagnóstico do Maestro e screenshots das três etapas. Preserva o exit code e
sanitiza os arquivos textuais ao terminar, inclusive após falha. Screenshots
precisam de revisão antes de compartilhar. O token não é passado na linha de
comando. Python pode ser chamado por `python3` em instalações sem alias `python`:
`python3 .github/scripts/run-e1.py`.

O caso cria um registro real e o mantém para auditoria. Executar somente em
ambiente de testes dedicado; a limpeza posterior pertence ao responsável e
não faz parte deste caso. O teste falha diante de título ausente/duplicado,
credencial inválida, atualização recusada ou ausência da notificação/status.

O E1 teve duas execuções integradas consecutivas aprovadas em 22/11/2026, no commit `a156a38`,
com cliente development, API compartilhada e push real. JUnit, modo utilizado
e capturas revisadas estão em
[evidências do E1](../docs/tas-evidence/e1-2026-11-22/README.md).
Ele não foi acrescentado à regressão agendada, que não possui os
pré-requisitos de push real.

Validação no GitHub Actions: [execução 38479762930](https://github.com/Lobiroka/SmartCitys/actions/runs/38479762930)
concluiu os três níveis com sucesso: 31 testes Jest, 24 testes de API e o fluxo
MVP Maestro. Os seis filtros avançados fora da TAS continuam sinalizados como
ignorados. Essa execução reutilizou o APK da execução 38445938768, cujo build
passou; o workflow conferiu que o código mobile e a configuração eram idênticos.

Deixe `apk_run_id` vazio para a regressão normal, que gera um APK novo.
Durante o diagnóstico do Maestro, é possível informar uma execução desta mesma
branch que tenha o artefato `apk-e2e-<run_id>`. O workflow confere se o código mobile
e a configuração de build são iguais antes de reutilizar o APK. Os três níveis de
testes continuam executando. Se modificar secrets de build, gere um APK novo.

## Registro com foto e GPS

O fluxo `registro-com-foto.yaml` habilita captura real da câmera no subfluxo de registro, salva a demanda e reabre Editar para verificar que foto e coordenadas vieram da API. O fluxo padrão existente mantém seu escopo; a captura adicional é habilitada apenas quando `E2E_WITH_PHOTO=1` é fornecido pelo novo fluxo.

Defina `MAESTRO_E2E_USERNAME`, `MAESTRO_E2E_PASSWORD` e um `MAESTRO_E2E_TITLE` exclusivo no ambiente, sem versionar valores. No development com Metro, defina também `MAESTRO_E2E_DEV_CLIENT=1`. Com um Android conectado, execute na raiz:

```bash
maestro test .maestro/registro-com-foto.yaml
```

Esse fluxo precisa de câmera/GPS funcionais e cria dados no ambiente real do aplicativo. O roteiro isolado não faz cadastro de conta nova, gestão nem verificação de push. A jornada final ampliada validou essas etapas em Android com cliente development e Metro; consulte as [evidências de 23/11/2026](../docs/tas-evidence/final-map-2026-11-23/README.md). A homologação do APK final independente do Metro permanece pendente.
## E3 — cenários negativos

A execução está conectada ao workflow **Regressão completa**, em
`.github/workflows/testes-api.yml`. Ele inicia automaticamente a cada push na
branch `hayana-test-e3` e em PRs para `main` com alterações nos fluxos Maestro,
nos scripts E3 ou no próprio workflow. O agendamento diário e o disparo manual
continuam disponíveis. PRs de forks não executam esse job com credenciais E2E.

Depois do commit e push, abra **GitHub → Actions → Regressão completa** e
selecione a execução da branch. O job prepara PostgreSQL/Redis e os serviços,
gera o APK e executa o MVP e os dois cenários negativos no emulador Android.
Em **Artifacts**, consulte `evidencias-e2e-<run_id>` e
`qualidade-regressao-<run_id>-<tentativa>`. O arquivo `negative-results.xml`
registra os resultados dos dois casos. A execução usa os secrets E2E e Maps
já exigidos pelo workflow; não é necessário colocá-los no código.

Uma nova atualização de push/PR cancela a regressão anterior da mesma branch,
para validar a versão mais recente. O acionamento só passa a existir no
GitHub depois que a alteração do workflow for enviada.

A regressão inclui dois casos independentes, com resultados JUnit separados:

| Caso | Ação no app | Resultado obrigatório |
|---|---|---|
| `negativos/registro-sem-titulo.yaml` | Preenche descrição e endereço, deixa o título vazio e tenta salvar | Exibe `Preencha título e descrição.`, permanece no formulário e não cria ocorrência |
| `negativos/acesso-ocorrencia-alheia.yaml` | Autentica o cidadão e abre por deep link a edição de um registro de outro dono | Exibe `Denúncia não encontrada`, sem apresentar título ou descrição privados |

São testes de ponta a ponta com app, Keycloak e backend reais. O primeiro
verifica a validação do formulário; o segundo passa pelo cliente HTTP
autenticado do app e pelo controle de propriedade da API. A resposta 404
oculta a existência da ocorrência para quem não é o dono.

O script `e3-fixture.cjs` prepara um cidadão sintético e sua ocorrência no
PostgreSQL temporário da regressão. Não cria conta Keycloak nem altera papéis.
O banco deve se chamar `smartcitys_test` e estar em loopback; o script rejeita
bancos de desenvolvimento e endereços remotos, inclusive RDS. O app deve usar
o backend conectado a esse mesmo banco. Não executar estes casos contra a
API compartilhada.

`run-e2e.sh` executa primeiro o MVP e depois os dois negativos, mesmo se o MVP
falhar. Antes e depois, confirma a existência e integridade da ocorrência
alheia; ao final, verifica também que o registro sem título não foi persistido.
A limpeza remove somente o registro sintético e seu dono. Falhas dos testes,
das verificações ou da limpeza mantêm a etapa E2E reprovada.

O fluxo de autenticação dos negativos aceita a sessão SSO da mesma conta
dedicada ou preenche o formulário Keycloak quando necessário. Não depende de
senha de outro usuário, token de gestor ou configuração de push real.

Os artefatos E2E incluem `mvp-results.xml`, `negative-results.xml`, o agregado
`results.xml`, screenshots e diagnósticos. A coleta existente publica esses
arquivos e inclui os três casos nos relatórios de qualidade. A agregação
reprova se não encontrar um caso MVP e dois negativos nos relatórios.

Validação local dos mecanismos de preparação e limpeza, sem conectar ao banco:

```sh
node --test .github/scripts/tests/e3-fixture.test.cjs
bash -n .github/scripts/run-e2e.sh
```

A execução integrada dos casos novos ainda precisa ser registrada na regressão.
