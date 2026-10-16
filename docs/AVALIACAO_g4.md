# Relatório de Avaliação - Unidade 1 - Desenvolvimento Mobile

## Resumo do Projeto
O grupo G4 desenvolveu o **Smart City**, um aplicativo mobile construído com React Native e Expo focado na gestão de ocorrências urbanas. O repositório adota um formato de monorepo, separando a aplicação em `apps/mobile` e serviços de backend (API Gateway, Metrics, Demand Service) nas pastas de `apps/backend`. O projeto utiliza a arquitetura MVVM, Expo Router, integração OAuth2.0 com Keycloak, testes usando Maestro e consumo de GPS/Câmera de forma clara.

## Membros
- FRANCISCO ÍTALO MACHADO DANTAS
- JOÃO EDUARDO MONTEIRO CAVALCANTI
- JONAS DE LIMA NETO
- JULIO BEZERRA COELHO
- LEONARDO FELIPE DEMÉTRIUS LINS NASCIMENTO
- LUIZ HENRIQUE DA SILVA NEVES
- MATHEUS JOSÉ CARDOSO LUNA
- MATHEUS RANGEL KIRZNER
- PAULO CESAR FERREIRA DE ASSIS
- ROBSON SANDRO ANDRADE CUNHA FILHO
- VICTOR GABRIEL FIGUEIRA DOS SANTOS

## Tabela de Avaliação (Total: 4,0 pontos)

| Critério | Valor Máximo | Nota Atribuída | Observações |
| :--- | :---: | :---: | :--- |
| **Entrega 1 (08/09)** | | | |
| Inclusão do colaborador `mr-costaalencar` | 0,2 | 0,2 | |
| **Entrega 2 (15/09)** | | | |
| Aplicação em React Native/Expo (Android/iOS) | 0,4 | 0,4 | Desenvolvido como workspace mobile (`apps/mobile`), atendendo ao pré-requisito com Expo SDK 57. |
| Arquitetura clara (MVVM ou MVC) | 0,3 | 0,3 | Adoção da arquitetura MVVM demonstrada no README e organização de pastas (`features/`). |
| Integração com o backend definido | 0,3 | 0,3 | Configuração de integração descrita e mapeada aos microsserviços. |
| **Entrega 3 (22/09)** | | | |
| Implementação de CRUD das ocorrências | 0,4 | 0,4 | Listado como pronto no checkbox do MVP para ocorrências abertas. |
| Listagem com componentes nativos | 0,3 | 0,3 | Utiliza de fato `FlatList` em `OccurrenceListScreen.tsx`. |
| Uso de GPS (Expo Location) | 0,3 | 0,3 | `expo-location` instalado; integrado com React Native Maps. |
| Uso de Câmera (Expo Camera/Image Picker) | 0,3 | 0,3 | `expo-camera` listado como implementado (criação de ocorrência com envio base64). |
| **Entrega 4 (29/09)** | | | |
| Navegação com Expo Router | 0,5 | 0,5 | Presente nas dependências e utilizado nas rotas protegidas (pasta `/app`). |
| Persistência/Estado (`useState`, `useEffect`)| 0,5 | 0,5 | O uso do Expo SecureStore para gerir os tokens OAuth com hooks garante o atendimento do critério. |
| Relatório de Uso de IA | 0,5 | 0,0 | Falta relatório descrevendo os resultados da IA e como foi feito a avaliação humana sobre tais resultados. |
| **TOTAL** |  | **3,5** |  |

## Pontos Positivos
- Uso de infraestrutura monorepo com microsserviços e front-end mobile.
- Implementação do padrão MVVM, facilitando a automação de testes nas diversas camadas do aplicativo.
- Uso de autenticação, separando responsabilidade para o Keycloak com padrão PKCE.

## Pontos de Melhoria
- Ajustar os itens de interface conforme listado no backlog (`Refinar a tela inicial de login`, etc), concluindo os refinamentos pendentes.
- Incluir relatório detalhado sobre o uso de IA, descrevendo os resultados obtidos e a avaliação humana sobre tais resultados.

