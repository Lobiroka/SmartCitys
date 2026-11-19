# Orientações para agentes — SmartCitys

## Antes de trabalhar

Leia [README.md](README.md), [CONTRIBUTING.md](CONTRIBUTING.md) e [docs/team-development.md](docs/team-development.md). Leia também as instruções `AGENTS.md` aplicáveis ao subdiretório alterado; no backend, elas incluem o modo de aprendizado e as convenções do serviço.

Confira `git status --short --branch`, o diff existente e o código relevante antes de editar. Preserve alterações do integrante e de outras tarefas. Não descarte stashes, dados, branches ou worktrees sem autorização específica.

Explique o problema, a abordagem e os arquivos envolvidos antes de mudanças grandes. Este é um projeto educacional: deixe claro o que mudou, por quê e como validar. Quando a tarefa pedir implementação, avance dentro do escopo autorizado.

## Modo de aprendizado e autorização

O integrante pode estar aprendendo React Native, TypeScript e backend. Quando pedir ensino ou orientação, explique o conceito e o motivo, divida em pequenos passos e apresente um passo por vez. Aguarde sua tentativa e analise o código; diante de um erro, explique e dê uma pista antes de entregar a solução completa. Explique a sintaxe e alternativas quando forem relevantes.

Não crie, edite ou exclua arquivos nem implemente funcionalidades completas sem autorização explícita. Pedidos como “faça”, “implemente” ou “corrija” autorizam executar o trabalho solicitado dentro de seu escopo; perguntas de compreensão não autorizam uma implementação inteira. O fluxo já combinado pelo integrante continua válido. Não transforme uma tarefa autorizada em sucessivas solicitações da mesma permissão.

## Arquitetura e contratos

- Mobile em `apps/mobile`: React Native/Expo/TypeScript com MVVM. Telas apresentam, ViewModels/hooks controlam estado, serviços encapsulam integrações e a composição conecta dependências.
- Backend em `apps/backend`: Gateway, Demand e Metrics. Preserve as responsabilidades de rotas, controllers, serviços e persistência existentes.
- Keycloak é responsável pela identidade. A API valida token e permissões; não confie em papéis enviados pelo cliente nem implemente autenticação paralela.
- Reutilize o cliente HTTP autenticado. Ao alterar contratos, confira DTOs, mapeadores, modelos, consumidores e testes.
- Preserve temas, acessibilidade, tratamento de permissões e identificadores dos fluxos Maestro.
- Use TypeScript, evite `any`, alterações sem relação com a tarefa e novas dependências sem justificar a necessidade.

## Ambiente e comandos

Execute na raiz:

- `npm.cmd ci`: dependências do monorepo.
- `npm.cmd run team:android`: development client + API compartilhada.
- `npm.cmd run team:backend -- up`: stack local com PostgreSQL e Redis próprios.
- `npm.cmd run team:android:local`: development client + API local por ADB.
- `npm.cmd run team:backend -- test`: API em banco/cache exclusivos de testes.
- `npm.cmd run mobile:test`: testes mobile.
- `npm.cmd run mobile:lint`: análise estática mobile.
- `git diff --check`: verificação do diff.

O Android deve usar o APK development e ter apenas um dispositivo autorizado conectado. O preview é destinado à avaliação do app pronto. Backend local exige Docker com containers Linux. Não execute testes destrutivos no RDS nem use a conta E2E para desenvolvimento pessoal.

## Banco e credenciais

Crie migrations novas pelo fluxo local; revise e versione SQL e schema juntos. Não edite migrations aplicadas, não faça reset no ambiente compartilhado e não substitua migrations por `db push`. O comando de geração da equipe atende Demand; mantenha o schema de leitura de Metrics compatível quando necessário.

Não solicite nem exponha credenciais privadas AWS, RDS, SSH, Firebase Admin, assinatura ou publicação para tarefas locais. Não imprima secrets ou arquivos de ambiente. Chaves cliente contidas no APK não são segredos ocultos; preserve as restrições do Maps. O push real fica desativado no backend local.

O isolamento dos secrets da CI ainda depende da ativação descrita na PR #24 e no guia. Não presuma essa proteção concluída e não use workflows para extrair secrets.

## Validação e entrega

Execute testes relevantes ao comportamento alterado e os checks exigidos pelo repositório. Não desative testes, autorização ou validações para obter aprovação. Registre comandos, resultados e limitações, incluindo falhas preexistentes; a declaração TypeScript de `global.css` é uma limitação já documentada.

Trabalhe em branch própria. Os nomes das branches e a organização dos commits seguem o fluxo escolhido pelo integrante e sua ferramenta, sem prefixo obrigatório por agente. Faça commits, pushes e PRs somente quando autorizados pela tarefa ou pelo fluxo já combinado com o integrante.

As contribuições dos colegas exigem revisão do responsável (`@DarkArtsBM`, conforme CODEOWNERS) e checks. Não contorne os rulesets, use credenciais do responsável ou integre PRs de colegas por conta própria.

Publicação AWS/Expo, migrations no RDS e alterações de IAM, DNS, Keycloak, secrets, regras de acesso ou assinatura exigem autorização específica. Não altere identificadores nativos para resolver um problema local. Push na main não gera APK automaticamente.

Ao concluir, explique o resultado, arquivos relevantes, testes e eventuais ações do responsável para ativação. Para falhas e manutenção de testes, siga [docs/tas.md](docs/tas.md).
