# Casos de teste derivados com apoio de IA

Este arquivo registra a segunda rodada de geração de casos de teste do Smart City. Os casos foram revisados contra o código, o README, as suítes existentes e o fluxo Maestro. Suposições da primeira rodada, como protocolo `DEM`, status `RECEIVED`, função `transicaoPermitida` e endpoint `/api/v1/demands`, foram removidas por não representarem o projeto atual.

## Referências do projeto

- Aplicativo mobile: React Native com Expo e arquitetura MVVM.
- Autenticação: Keycloak com OAuth 2.0/OpenID Connect e PKCE.
- API de ocorrências: rotas sob `/demandas`, incluindo criação, listagem própria, feed e operações por identificador.
- Estados comprovados: `ABERTA`, `EM_ANALISE` e `RESOLVIDA`.
- Testes mobile: Jest e React Native Testing Library.
- Testes de API: Vitest, Supertest, Prisma e banco de testes.
- Teste de sistema: `.maestro/mvp.yaml`.

## Histórias de usuário e critérios de aceite

### HU-01 Autenticação e sessão

Como cidadão, quero autenticar e manter minha sessão para acessar o aplicativo com segurança.

- CA-01: usuário sem sessão visualiza a tela de login.
- CA-02: login válido libera as rotas protegidas.
- CA-03: sessão válida é restaurada ao reabrir o aplicativo.
- CA-04: logout apaga os tokens e retorna ao login.
- CA-05: falha de autenticação é apresentada sem liberar acesso.

### HU-02 Registro de ocorrência

Como cidadão, quero registrar uma ocorrência com dados e localização para comunicar um problema urbano.

- CA-01: título, descrição e endereço são obrigatórios.
- CA-02: latitude e longitude são exigidas na criação.
- CA-03: categoria e região devem pertencer aos valores aceitos pelo sistema.
- CA-04: criação válida persiste a ocorrência com status inicial `ABERTA`.
- CA-05: requisição sem token ou realizada por gestor é bloqueada.

### HU-03 Consulta e pesquisa

Como cidadão, quero consultar e pesquisar minhas ocorrências para acompanhar o que registrei.

- CA-01: a lista é carregada quando a tela recebe foco.
- CA-02: estados vazio, carregando e erro são apresentados.
- CA-03: pesquisa textual pode ser combinada com o filtro local por status.
- CA-04: falha de atualização não apaga os dados já carregados.
- CA-05: a API respeita página e limite e informa os metadados de paginação.

### HU-04 Edição e exclusão

Como cidadão, quero editar ou excluir uma ocorrência aberta para corrigir ou remover meu registro.

- CA-01: o modo de edição carrega os detalhes e chama a operação de atualização.
- CA-02: a exclusão exige confirmação.
- CA-03: o item só é removido da lista depois da confirmação do serviço.
- CA-04: ocorrência finalizada não oferece edição nem exclusão.

### HU-05 Visualização no mapa

Como cidadão, quero visualizar ocorrências georreferenciadas no mapa para compreender sua localização.

- CA-01: somente ocorrências com latitude e longitude viram marcadores.
- CA-02: o aplicativo solicita permissão de localização.
- CA-03: permissão bloqueada apresenta orientação e acesso às configurações.
- CA-04: falha desconhecida é convertida em mensagem segura para o usuário.

## Casos de teste

### TC-01 Tela sem sessão

- **HU e CA:** HU-01, CA-01
- **Nível:** Componente
- **Técnica:** Transição de estados da sessão
- **Modalidade:** Automatizado
- **Pré-condições:** armazenamento de tokens sem sessão válida.
- **Passos:** iniciar o aplicativo e aguardar a restauração da sessão.
- **Resultado esperado:** a tela de login é exibida e o mapa permanece inacessível.
- **Pós-condições:** nenhuma sessão criada.

### TC-02 Login válido

- **HU e CA:** HU-01, CA-02
- **Nível:** Sistema E2E
- **Técnica:** Fluxo funcional positivo
- **Modalidade:** Automatizado com Maestro
- **Pré-condições:** build instalado, Keycloak acessível e credenciais exclusivas de teste.
- **Passos:** tocar no botão de login, informar usuário e senha válidos e confirmar.
- **Resultado esperado:** a autenticação é concluída e as rotas protegidas são abertas.
- **Pós-condições:** sessão salva com segurança no dispositivo.

### TC-03 Logout

- **HU e CA:** HU-01, CA-04
- **Nível:** Sistema E2E
- **Técnica:** Transição de estados da sessão
- **Modalidade:** Automatizável
- **Pré-condições:** usuário autenticado.
- **Passos:** tocar em `Sair` e reabrir o aplicativo.
- **Resultado esperado:** os tokens são apagados e a tela de login volta a ser exibida.
- **Pós-condições:** dispositivo sem sessão autenticada.

### TC-04 Campos obrigatórios vazios

- **HU e CA:** HU-02, CA-01
- **Nível:** Componente
- **Técnica:** Tabela de decisão
- **Modalidade:** Automatizado
- **Pré-condições:** formulário de criação aberto.
- **Passos:** tentar salvar sem título, descrição e endereço.
- **Resultado esperado:** a mensagem `Preencha título, descrição e endereço.` é apresentada e o serviço não é chamado.
- **Pós-condições:** nenhuma ocorrência criada.

### TC-05 Partições dos campos obrigatórios

- **HU e CA:** HU-02, CA-01
- **Nível:** Componente
- **Técnica:** Particionamento de equivalência
- **Modalidade:** Automatizável
- **Pré-condições:** formulário de criação aberto.
- **Passos:** repetir o salvamento omitindo, separadamente, título, descrição e endereço.
- **Resultado esperado:** cada partição inválida é recusada antes da chamada ao backend.
- **Pós-condições:** nenhuma ocorrência criada.

### TC-06 Coordenadas ausentes

- **HU e CA:** HU-02, CA-02
- **Nível:** Componente
- **Técnica:** Particionamento de equivalência
- **Modalidade:** Automatizado
- **Pré-condições:** campos textuais válidos e localização ainda não obtida.
- **Passos:** tentar salvar a ocorrência.
- **Resultado esperado:** o ViewModel exige as coordenadas e não chama o serviço de criação.
- **Pós-condições:** nenhuma ocorrência criada.

### TC-07 Normalização dos dados na criação

- **HU e CA:** HU-02, CA-02 e CA-03
- **Nível:** Componente
- **Técnica:** Fluxo de dados
- **Modalidade:** Automatizado
- **Pré-condições:** serviço de localização configurado para devolver coordenadas válidas.
- **Passos:** preencher o formulário, obter a localização e salvar.
- **Resultado esperado:** o serviço recebe um input normalizado com título, descrição, endereço, categoria, região, prioridade, latitude e longitude.
- **Pós-condições:** input enviado ao serviço mock.

### TC-08 Criação válida na API

- **HU e CA:** HU-02, CA-04
- **Nível:** Integração de API
- **Técnica:** Fluxo funcional positivo
- **Modalidade:** Automatizado
- **Endpoint:** `POST /demandas`
- **Pré-condições:** banco de teste disponível e token de cidadão válido.
- **Passos:** enviar payload válido com título, descrição, categoria, região, endereço, prioridade e coordenadas.
- **Resultado esperado:** HTTP 201, identificador definido, dados persistidos e status `ABERTA`.
- **Pós-condições:** registro removido no encerramento da suíte.

### TC-09 Criação sem token

- **HU e CA:** HU-02, CA-05
- **Nível:** Integração de API
- **Técnica:** Tabela de decisão de autorização
- **Modalidade:** Automatizado
- **Endpoint:** `POST /demandas`
- **Pré-condições:** nenhuma.
- **Passos:** enviar payload válido sem o cabeçalho `Authorization`.
- **Resultado esperado:** HTTP 401.
- **Pós-condições:** nenhuma ocorrência criada.

### TC-10 Gestor tenta criar ocorrência

- **HU e CA:** HU-02, CA-05
- **Nível:** Integração de API
- **Técnica:** Tabela de decisão de perfil por operação
- **Modalidade:** Automatizado
- **Endpoint:** `POST /demandas`
- **Pré-condições:** token válido com papel `gestor`.
- **Passos:** enviar payload válido com `Authorization: Bearer <token>`.
- **Resultado esperado:** HTTP 403 e mensagem `Acesso negado para este perfil`.
- **Pós-condições:** nenhuma ocorrência criada.

### TC-11 Carregamento da lista ao receber foco

- **HU e CA:** HU-03, CA-01
- **Nível:** Componente
- **Técnica:** Transição de estado da tela
- **Modalidade:** Automatizado
- **Pré-condições:** serviço mock configurado com uma ocorrência.
- **Passos:** renderizar a tela e simular o recebimento de foco.
- **Resultado esperado:** o serviço é chamado e a ocorrência é apresentada.
- **Pós-condições:** lista preenchida na memória.

### TC-12 Primeira página com limite dois

- **HU e CA:** HU-03, CA-05
- **Nível:** Integração de API
- **Técnica:** Análise de valor-limite
- **Modalidade:** Automatizado
- **Endpoint:** `GET /demandas/my-demands?page=1&limit=2`
- **Pré-condições:** pelo menos cinco ocorrências do cidadão no banco de teste.
- **Passos:** consultar a primeira página com limite dois.
- **Resultado esperado:** HTTP 200, dois itens e metadados coerentes de página, limite, total e total de páginas.
- **Pós-condições:** massa preservada até o encerramento da suíte.

### TC-13 Página fora do intervalo

- **HU e CA:** HU-03, CA-05
- **Nível:** Integração de API
- **Técnica:** Análise de valor-limite
- **Modalidade:** Automatizado
- **Endpoint:** `GET /demandas/my-demands?page=999&limit=20`
- **Pré-condições:** cidadão com ocorrências cadastradas.
- **Passos:** consultar uma página além do total disponível.
- **Resultado esperado:** HTTP 200, `data` vazio e `pagination.total` mantendo o total real.
- **Pós-condições:** nenhuma alteração nos registros.

### TC-14 Pesquisa combinada com status

- **HU e CA:** HU-03, CA-03
- **Nível:** Componente
- **Técnica:** Tabela de decisão
- **Modalidade:** Automatizado
- **Pré-condições:** lista com títulos, descrições e estados variados.
- **Passos:** informar texto de pesquisa e selecionar um status.
- **Resultado esperado:** somente ocorrências que atendem simultaneamente aos dois critérios permanecem visíveis.
- **Pós-condições:** lista original preservada.

### TC-15 Falha de atualização preserva dados

- **HU e CA:** HU-03, CA-04
- **Nível:** Componente
- **Técnica:** Injeção de falha
- **Modalidade:** Automatizado
- **Pré-condições:** lista carregada e serviço configurado para falhar na próxima chamada.
- **Passos:** solicitar nova carga.
- **Resultado esperado:** uma mensagem segura é apresentada sem apagar os dados existentes.
- **Pós-condições:** lista anterior mantida.

### TC-16 Editar ocorrência aberta

- **HU e CA:** HU-04, CA-01
- **Nível:** Componente
- **Técnica:** Transição de estados
- **Modalidade:** Automatizado
- **Pré-condições:** ocorrência com status `ABERTA` existente.
- **Passos:** abrir em modo de edição, alterar um campo e salvar.
- **Resultado esperado:** os detalhes são carregados, o serviço `update` é chamado e a tela retorna apenas após o sucesso.
- **Pós-condições:** registro atualizado pelo serviço configurado.

### TC-17 Bloquear ações em ocorrência finalizada

- **HU e CA:** HU-04, CA-04
- **Nível:** Integração de componentes
- **Técnica:** Transição de estados
- **Modalidade:** Automatizado
- **Pré-condições:** ocorrência com status diferente de `ABERTA`.
- **Passos:** renderizar o item na lista e inspecionar as ações disponíveis.
- **Resultado esperado:** editar e excluir não ficam disponíveis.
- **Pós-condições:** nenhuma alteração.

### TC-18 Filtrar marcadores do mapa

- **HU e CA:** HU-05, CA-01
- **Nível:** Componente
- **Técnica:** Tabela de decisão
- **Modalidade:** Automatizado
- **Pré-condições:** feed contendo ocorrências com duas, uma ou nenhuma coordenada.
- **Passos:** carregar o feed do mapa.
- **Resultado esperado:** somente itens com latitude e longitude são convertidos em marcadores.
- **Pós-condições:** nenhuma alteração nos dados de origem.

### TC-19 Permissão de localização concedida

- **HU e CA:** HU-05, CA-02
- **Nível:** Aceite
- **Técnica:** Transição de estados de permissão
- **Modalidade:** Manual
- **Pré-condições:** aparelho físico ou emulador com GPS disponível e permissão ainda não decidida.
- **Passos:** solicitar a localização e conceder a permissão.
- **Resultado esperado:** a posição é obtida, acompanhada e pode ser usada no formulário.
- **Pós-condições:** permissão concedida ao aplicativo.

### TC-20 Permissão de localização bloqueada

- **HU e CA:** HU-05, CA-03
- **Nível:** Aceite
- **Técnica:** Transição de estados de permissão
- **Modalidade:** Manual
- **Pré-condições:** permissão configurada para não perguntar novamente.
- **Passos:** solicitar a localização.
- **Resultado esperado:** o aplicativo apresenta erro compreensível e opção para abrir suas configurações.
- **Pós-condições:** usuário pode reabilitar manualmente a permissão.

### TC-21 Caminho crítico do MVP

- **HU e CA:** HU-01, HU-02 e HU-03; fluxo crítico
- **Nível:** Sistema E2E
- **Técnica:** Fluxo funcional ponta a ponta
- **Modalidade:** Automatizado com Maestro
- **Pré-condições:** build instalado; Metro quando necessário; Keycloak, API e banco acessíveis; usuário exclusivo; permissões de câmera e localização concedidas.
- **Passos:** executar `.maestro/mvp.yaml`, autenticar, abrir ocorrências, validar obrigatoriedade, preencher o formulário, obter GPS, salvar e aguardar a listagem.
- **Resultado esperado:** login concluído, validação apresentada, ocorrência criada pelo backend e título visível na lista.
- **Pós-condições:** uma ocorrência real criada no ambiente de teste.

### TC-22 Compatibilidade do caminho crítico no iOS

- **HU e CA:** HU-01 a HU-05; compatibilidade de plataforma
- **Nível:** Aceite
- **Técnica:** Compatibilidade
- **Modalidade:** Manual
- **Pré-condições:** macOS, Xcode, build iOS, Keycloak e backend acessíveis.
- **Passos:** executar no iOS o roteiro crítico de autenticação, permissões, mapa, criação, listagem, edição e exclusão.
- **Resultado esperado:** os fluxos apresentam comportamento equivalente ao Android, respeitando as diferenças nativas de permissão e mapa.
- **Pós-condições:** evidências registradas por dispositivo e versão; caso permanece pendente até execução.

## Pendências e limites conhecidos

- O fluxo Maestro está preparado, mas sua execução completa depende de Keycloak, API, banco, build e credenciais de teste disponíveis.
- A validação em iOS ainda depende de macOS e Xcode.
- Os filtros avançados de API por categoria, status, região e prioridade continuam fora da cobertura aprovada porque os respectivos query parameters ainda não estão implementados no backend; os testes existentes permanecem com `it.skip`.
- Câmera física, precisão do GPS e disponibilidade interna de serviços externos não são verificadas; o plano cobre apenas o comportamento observável do aplicativo na fronteira.
- Carga e estresse permanecem fora do escopo enquanto não houver meta de desempenho e ambiente representativo.
