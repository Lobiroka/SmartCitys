# Como a equipe e seus agentes devem trabalhar

Este roteiro vale para contribuições no app e no backend do SmartCitys. Leia também o [README](README.md), o [AGENTS.md](AGENTS.md) e o [guia técnico do ambiente da equipe](docs/team-development.md).

## 1. Responsabilidades e ambiente

Cada integrante desenvolve em sua própria branch e usa sua conta pessoal no Keycloak de testes. O papel inicial é `cidadao`; solicite ao responsável o papel `gestor` apenas quando a tarefa exigir. Não use a conta administrativa nem a conta E2E da CI.

O responsável pela infraestrutura e revisão é Robson; o CODEOWNERS atual aponta para `@DarkArtsBM`. Os colegas e seus agentes entregam alterações por PR. Publicação na AWS, migrations no RDS, assinatura de APK e publicação no Expo são coordenadas pelo responsável.

| Para fazer | Ambiente a usar |
|---|---|
| Alterar telas e lógica do app com a API já integrada | APK development + Metro + API compartilhada |
| Alterar contratos, regras, permissões ou persistência da API | Backend local + app apontando para a API local |
| Executar testes que criam ou removem registros | Banco e Redis exclusivos de testes |
| Avaliar o aplicativo pronto | APK preview |
| Publicar uma alteração integrada | Fluxo do responsável após revisão e checks |

A API compartilhada é `https://api.darkartsbm.com`. Ela contém dados comuns da equipe, não um sandbox individual. Use dados fictícios identificados pelo integrante. Para testar exclusões, migrations e mudanças de backend, prefira o ambiente local; testes automatizados de banco não devem apontar para o RDS.

## 2. Preparar a máquina uma vez

Instale Git, Node.js 22 LTS e Android Studio/SDK. Para backend local, instale e inicie Docker Desktop com containers Linux. Abra um emulador com Google Play ou conecte um Android autorizado por USB.

```powershell
git clone https://github.com/Lobiroka/SmartCitys.git
cd SmartCitys
npm.cmd ci
```

Instale o [APK development da equipe](https://expo.dev/accounts/dkartss-team/projects/wb/builds/103030d5-f0d1-4134-a6c2-5f0458cc7931). O preview serve para avaliação e não carrega o código da sua máquina. Como os perfis usam o mesmo pacote Android, prefira um emulador dedicado ao desenvolvimento.

O uso de `npm.cmd` no PowerShell evita depender da permissão para executar o arquivo `npm.ps1`. Os comandos abaixo são executados na raiz do repositório.

## 3. Começar uma tarefa

Confira o estado do checkout e atualize a referência remota antes de criar a branch:

```powershell
git status --short --branch
git fetch origin
git switch -c feature/nome-da-tarefa origin/main
```

Use `fix/nome-do-problema` para correções e `codex/nome-da-tarefa` para trabalho de agentes Codex, salvo convenção explicitamente combinada na tarefa. Cada tarefa deve ter um objetivo claro e uma PR focada.

Se houver alterações locais, identifique a quem pertencem antes de trocar de branch. Preserve alterações e stashes de outras pessoas. Não use `reset --hard`, `clean`, exclusão de branches ou remoção de worktrees para resolver um conflito sem autorização específica. Se a main estiver aberta em outro worktree, trabalhe a partir de `origin/main`; não force sua abertura no checkout errado.

Antes de editar, descreva o problema, o comportamento esperado e os arquivos/camadas envolvidos. Confirme no código quais rotas, modelos e serviços já existem. Pergunte somente quando faltar uma decisão necessária; não invente contratos ou estado da infraestrutura.

Este também é um projeto de aprendizado. Se o integrante pedir para aprender, o agente deve explicar em passos pequenos, aguardar a tentativa e orientar a correção antes de entregar uma solução pronta. Se pedir explicitamente para implementar, o agente pode executar a tarefa autorizada e depois explicar o que fez e por quê.

## 4. Rodar o que está desenvolvendo

### Somente app, usando a API compartilhada

```powershell
npm.cmd run team:android
```

O atalho carrega configuração pública, encaminha a porta 8081 e abre o cliente development. Mantenha apenas um Android autorizado conectado. Não é necessário receber credenciais privadas para iniciar o Metro.

### App e backend próprios

No primeiro terminal:

```powershell
npm.cmd run team:backend -- up
curl.exe http://127.0.0.1:8080/health
```

Em outro terminal:

```powershell
npm.cmd run team:android:local
```

O app usa `127.0.0.1:8080` por encaminhamento ADB; o login permanece no Keycloak de testes. A stack cria senhas locais e não exige senha do RDS, chave SSH ou acesso IAM.

```powershell
npm.cmd run team:backend -- logs
npm.cmd run team:backend -- down
```

`down` preserva os bancos. Preserve também `apps/backend/.env.team.local`, pois recriar senhas sem recriar os volumes gera incompatibilidade de acesso. Execute `up` novamente depois de trocar de branch ou dependências. A stack tem nome e portas fixos: use apenas um checkout ativo para ela por computador.

## 5. Onde alterar o código

| Mudança | Local e responsabilidade |
|---|---|
| Rotas e navegação do app | `apps/mobile/app` e `src/navigation` |
| Telas e estado de uma funcionalidade | `apps/mobile/src/features/<funcionalidade>` |
| Montagem de serviços e dependências | `apps/mobile/src/composition` |
| HTTP autenticado compartilhado | `apps/mobile/src/shared/http` |
| Entrada e encaminhamento da API | `apps/backend/api-gateway` |
| Ocorrências, cidadão/gestor e push | `apps/backend/demand-service` |
| Métricas, cache e eventos | `apps/backend/metrics-service` |
| Modelos persistidos e migrations | Diretórios `prisma` dos serviços |

### App: preservar MVVM

- A tela apresenta os dados e encaminha interações ao ViewModel/hook.
- O ViewModel controla estado, carregamento, erros e ações da funcionalidade.
- Serviços encapsulam HTTP, Keycloak, localização, câmera e armazenamento.
- A composição conecta as implementações. Reutilize o cliente HTTP autenticado existente.

Evite requisições HTTP e regras de negócio diretamente no JSX, duplicação de sessão e novos fluxos paralelos de autenticação. Preserve acessibilidade, temas, tratamento de permissões e os identificadores usados pelos testes Maestro.

### Backend: preservar as responsabilidades

Routes encaminham, controllers interpretam a requisição, services concentram regras e a camada de persistência existente acessa o banco. Siga o padrão do serviço alterado; não introduza uma nova arquitetura apenas para uma tarefa pequena.

Keycloak gerencia identidade; o backend valida os tokens e as permissões. Não substitua essa validação por um papel enviado pelo app e não crie autenticação própria com senha/JWT compartilhado. O frontend ocultar uma aba não substitui autorização na API.

Quando alterar um contrato, confira também DTOs, mapeadores, modelos e consumidores mobile. Endereço ou GPS devem continuar atendendo à regra de localização da ocorrência. Documente incompatibilidades e a ordem de publicação antes de integrar.

Use TypeScript e evite `any`. Prefira alterações pequenas. Explique a necessidade antes de adicionar dependências; mantenha o lockfile correspondente atualizado quando isso fizer parte da tarefa. Não misture refatorações ou formatação de arquivos sem relação com o objetivo.

## 6. Alterações no banco

Edite o schema Prisma do serviço correto e gere uma nova migration no banco local:

```powershell
npm.cmd run team:backend -- migration nome_da_mudanca
npm.cmd run team:backend -- migrate
npm.cmd run team:backend -- up
npm.cmd run team:backend -- test
```

O primeiro comando atende o schema do Demand Service e gera SQL com `--create-only`. Revise o SQL antes de aplicá-lo e versione schema e migration juntos. Se a alteração afetar o modelo de leitura de Metrics, ajuste seu schema/client de forma compatível; não gere migrations concorrentes de Metrics sobre tabelas administradas por Demand.

Não reescreva migrations já aplicadas, não use `db push` como substituto de migration versionada e não execute reset no banco compartilhado. Mudanças destrutivas precisam de avaliação dos dados, backup e plano de retorno pelo responsável. Aplicar a migration localmente não aplica a mudança na AWS.

## 7. Validar antes da PR

| Alteração | Verificação esperada |
|---|---|
| Tela, estado ou serviço mobile | Testes relevantes, suíte mobile e conferência visual do fluxo alterado |
| Regra/rota/permissão/persistência da API | Testes da API em banco exclusivo e uso com backend local |
| Contrato compartilhado | Testes de API e consumidores mobile |
| Dependência/plugin/permissão nativa | Revisão com o responsável e novo development build quando necessário |
| Documentação | Links, comandos existentes e coerência com o código |

```powershell
npm.cmd run mobile:test
npm.cmd run mobile:lint
npm.cmd run team:backend -- test
git diff --check
```

Execute as verificações aplicáveis à mudança. Não crie testes que apenas repitam detalhes de implementação; cubra comportamento, permissões, erros ou regressões relevantes. Não remova testes, expectativas ou autorização para fazer a CI ficar verde.

Há uma limitação já registrada na checagem TypeScript do import de `global.css`. Compare com a base e relate separadamente os problemas preexistentes. Informe exatamente os comandos executados, resultados, testes desativados e o que não foi possível validar; não declare aprovação de uma verificação que falhou ou não foi executada.

O fluxo Maestro usa uma conta exclusiva da automação. Os integrantes não precisam receber sua senha. Falhas de produto, automação, ambiente e variações esperadas devem ser encaminhadas conforme a [política da TAS](docs/tas.md); não mascarar testes instáveis com retries ilimitados.

## 8. Entregar a tarefa

Revise o diff e adicione somente os arquivos da tarefa. Faça commit e push quando autorizados pelo integrante; não envie `.env`, credenciais ou arquivos de outras tarefas.

Abra PR com base `main`, descrevendo:

1. Problema e comportamento resultante.
2. Alterações relevantes, contratos e eventual migration.
3. Testes executados e evidências visuais quando houver alteração de tela.
4. Limitações e necessidade de deploy, OTA ou novo APK.

Os checks e a revisão do Code Owner seguem os rulesets do repositório. Colegas e seus agentes não devem contornar a revisão do responsável, usar suas credenciais ou integrar a PR por conta própria. Novos commits podem invalidar uma aprovação anterior; aguarde os checks e a revisão do estado final.

Depois da integração, o responsável coordena AWS/migrations quando necessárias e a publicação compatível no Expo. Push na main não gera automaticamente APK. OTA e build nativo têm requisitos diferentes; veja o [guia de distribuição](apps/mobile/RELEASE-PREVIEW.md).

## 9. Credenciais e limites de atuação dos agentes

- Não peça ou distribua chave AWS, senha do RDS, chave SSH, keystore, token de publicação ou JSON privado Firebase Admin para iniciar o desenvolvimento.
- Não imprima `.env`, tokens ou senhas em logs, prompts, PRs ou evidências. Se faltar configuração pública, confira os exemplos e o guia; se faltar acesso administrativo, encaminhe ao responsável.
- Chaves Maps e configuração Firebase cliente estão presentes no APK e não são segredos inextragíveis. Restrições de pacote/certificado/API continuam necessárias; nunca abra essas restrições para facilitar um teste.
- Não altere IAM, Keycloak, DNS, RDS, secrets, rulesets, publicação Expo ou infraestrutura compartilhada sem autorização específica da tarefa. Não modifique pacote, scheme, projeto Expo ou configuração nativa para contornar um problema local.
- O backend local mantém push real desativado. Teste a lógica com mocks; a entrega real é validada no ambiente de integração pelo responsável.
- A proteção dos secrets da CI ainda está pendente na PR #24. Não presuma que acesso de escrita ao GitHub esteja isolado dos Repository secrets; não use workflows para extrair credenciais. A ativação de `ci-main` está descrita no guia técnico.

## 10. Como orientar o agente de cada integrante

O `AGENTS.md` da raiz contém as orientações comuns para agentes que reconhecem esse arquivo. Para outras ferramentas, indique explicitamente os arquivos no pedido inicial. Instruções aplicáveis de subdiretórios também devem ser lidas.

Exemplo de pedido para começar uma tarefa:

```text
Leia AGENTS.md, CONTRIBUTING.md e docs/team-development.md.
Objetivo: [descreva a mudança e como saberemos que funciona].
Trabalhe em uma branch própria baseada na origin/main atualizada.
Confira a implementação existente e preserve MVVM e autorização Keycloak.
Use API/bancos locais para alterar e testar o backend.
Não publique em AWS/Expo nem use credenciais do responsável.
Antes de mudanças grandes, explique os arquivos e a abordagem.
Ao terminar, informe alterações, testes, limitações e como revisar.
Faça commit, push ou abra PR somente se isso estiver autorizado nesta tarefa.
```

O guia informa o fluxo do projeto; não autoriza acesso administrativo ou publicação por si só. Se a tarefa depender de configuração do responsável, entregue o trabalho revisável e indique a dependência concreta.
