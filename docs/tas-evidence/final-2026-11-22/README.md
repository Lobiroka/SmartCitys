# Jornada completa da entrega final — 22/11/2026

## Resultado

**Aprovado: três etapas, zero falhas, código de saída 0**, em uma única execução
com conta e ocorrência novas, sem retry global nem salto de etapas.

Execução `final-b48f59c897d54b24b2d7a4ea3ccf2956`, em 22/11/2026, das
16:19:38 às 16:26:22 (America/Sao_Paulo): aproximadamente **6min44s**.
Código validado: [bbd79c8](https://github.com/Lobiroka/SmartCitys/commit/bbd79c883dbfd8fb13faf2ec127557781ad0fa77).

| Etapa | Resultado | Duração do executor | JUnit |
|---|---|---|---|
| Cadastro, login, foto/GPS, pesquisa, filtros e persistência | Aprovada | 271,507 s | [Cidadão](citizen-register-and-report.xml) |
| Gestor confere o registro e altera o status pela tela | Aprovada | 83,568 s | [Gestor](manager-update.xml) |
| Cidadão recebe push real e acompanha Em análise | Aprovada | 49,114 s | [Notificação](citizen-notification.xml) |

[JUnit agregado](results.xml), [metadados da execução](execution.json) e
[integridade dos arquivos textuais](sha256.json). Os tempos do executor incluem
a inicialização do Maestro e diferem dos tempos de cenário no JUnit.
O registro validado foi a ocorrência fictícia **#8**, identificada pelo título
exclusivo da execução, sem selecionar um registro arbitrário.

As sete capturas de marcos permanecem localmente em
`test-results/e2e/final-b48f59c897d54b24b2d7a4ea3ccf2956/`, nas subpastas
`takeScreenshot`, aguardando a revisão humana do responsável exigida pela TAS
antes de publicar imagens. Não foram incluídas no Git. Há capturas do cadastro,
login, foto recarregada, foto/GPS do gestor, alteração salva, push e status final.

## Escopo e ambiente

Branch `mobile-entrega-final`, preservando o commit-base `0a13432`.
Windows, Maestro CLI 2.12.1 e dois emuladores Android API 36:
`SmartCity_API_36` (`emulator-5554`, cidadão) e `SmartCity_Gestor_API_36`
(`emulator-5556`, gestor). APK development com JavaScript da branch servido
pelo Metro; API `https://api.darkartsbm.com` e Keycloak `smartcitys-test`.
Esse modo verifica a integração do código e não representa homologação de um APK final.

O cidadão é criado do zero pelo formulário público do Keycloak. O gestor usa
conta dedicada já existente. Ambos autenticam pela interface do app, com código
e PKCE. O roteiro não cadastra usuários por API administrativa, não injeta tokens
e não altera status por chamadas externas à interface do gestor.

| Etapa | Comprovação exigida |
|---|---|
| Cadastro/login | Formulário real, retorno ao app, logout e novo login; cidadão sem aba Gestão |
| Registro | Campos obrigatórios, GPS, captura da câmera e ocorrência na API |
| Persistência/acompanhamento | Pesquisa pelo título único, filtros Aberta/Em análise e reabertura com foto/GPS |
| Gestão | Outro Android e usuário; mesmo título, foto/GPS e status alterado pela tela |
| Notificação | Bandeja sem a mensagem antes da alteração e push real depois dela |
| Estado final | Mesmo título em Em análise e ausente no filtro Aberta do cidadão |

## Reprodução

Seguir o [guia Maestro](../../../.maestro/README.md#jornada-completa-da-entrega-final).
São dispositivos exclusivos de teste: o fluxo limpa os dados do app **e do Chrome**.
As credenciais do gestor entram pelo ambiente ou arquivo local ignorado; as do
novo cidadão são geradas em memória. A conta fictícia e a ocorrência permanecem
no ambiente de testes para auditoria pelo identificador da execução.

```powershell
npm.cmd run mobile:test:e2e:final -- `
  --citizen-device emulator-5554 --manager-device emulator-5556 `
  --credentials-file CAMINHO_LOCAL --dev-client
```

## Diagnóstico das tentativas anteriores

As falhas abaixo foram preservadas localmente em `test-results/e2e/`, sem
transformá-las em aprovação:

| Execução | Falha e tratamento |
|---|---|
| `final-4cf32ad1e89a44a68957dfd76acb45cc` | Captura antes da prontidão; exigir botão habilitado. Coletor Windows interrompido por codificação de console; configurar UTF-8 e garantir encerramento da árvore de processos própria em erro. |
| `final-f878983a50ce4976933194fd9f67ca00` | Keycloak recusou cadastro de outro usuário com sessão SSO anterior ativa; limpar também o Chrome dos dispositivos dedicados. |
| `final-a7b4e92835fe443397c3011e57692392` | Apresentação inicial do Chrome carregou depois da verificação condicional; aguardar formulário ou apresentação antes de escolher o ramo. |
| `final-2456a3d96e8e4030b7fc3215f96c7c13` | O filtro vazio estava correto, mas a asserção também encontrava o título no campo de busca. Identificar o título do cartão separadamente, tanto nas asserções positivas como nas negativas. |
| `final-4d3116bb5eeb4780ad89b26710d5a7d1` | Inicialização ficou numa tela branca, sem o menu Development Build. Conectar diretamente ao Metro e continuar exigindo a tela inicial do produto. |
| `final-d4de3cdde8874854adc032374a1f11bc` | A tela branca persistiu antes de alcançar o produto. Reiniciar o Metro próprio e iniciar o emulador cidadão sem snapshot, preservando seus dados. Não se afirma que a mudança do roteiro eliminou esta falha de ambiente. |
| `final-98620cdff15f43b3a325a33070fa1af2` | Após o reinício, o menu abriu, mas o link enviado antes da prontidão não conectou. Aguardar `Development Build` ou `Smart City` antes do link, com prazo explícito, e depois continuar exigindo a tela inicial. |

Um ensaio isolado de captura (`capture-check.xml`) passou após exigir o botão
habilitado. Esse ensaio não substitui a jornada completa. As correções tratam
prontidão, isolamento de sessão e coleta da TAS; não relaxam as asserções funcionais.

O diagnóstico sequencial `debug-remaining` confirmou pesquisa/filtros e reabertura
com foto/GPS (1min47s), alteração pelo gestor (1min11s) e recebimento de push real.
O primeiro retorno ao app falhou antes de carregar a navegação: passar a retomar
sem encerrar o processo e aguardar a aba, reconectando ao Metro no modo development.
Repetir apenas a espera de push depois de a tentativa anterior encerrar o app
não reutilizou uma notificação já removida; esse ensaio falhou e não foi contado
como aprovação. A busca também passou a preservar o título existente, pois apagar
a partir do meio do campo deixava um sufixo antigo. O diagnóstico parcial não
substitui um relatório aprovado da jornada inteira.

## Limites

O push tem mensagem genérica e exige conta nova/dedicada sem alterações concorrentes.
A foto e a localização são capturadas pelas integrações reais com o Android, com
cena e coordenadas do emulador. Um ensaio aprovado não demonstra estabilidade
histórica, funcionamento offline, todos os aparelhos ou distribuição final.
A câmera do emulador produz uma imagem sintética escura com carimbo de data/hora;
o gestor conseguiu exibir essa imagem persistida. A jornada valida coordenadas
GPS, mas não faz asserção de carregamento dos tiles do mapa.
Não houve mudança de infraestrutura, migration ou configuração administrativa.
Este teste explícito com push real não foi adicionado à regressão diária isolada.
Screenshots precisam de revisão humana antes da publicação; imagens, logs brutos
e credenciais não fazem parte das evidências versionadas.

## Verificações complementares

- **64 testes mobile**, em 16 suítes, aprovados; lint e TypeScript sem erros.
- **24 testes Python** do executor/coletores e **17 testes Node** das automações aprovados.
- Sintaxe dos roteiros Maestro e `git diff --check` aprovados.

Neste worktree Windows, `npm.cmd run mobile:test` não encontrou os testes por
uma combinação de separadores no padrão `rootDir`. A execução real das 16 suítes
usou o mesmo Jest com padrões relativos, sem ignorar testes:

```powershell
# Em apps/mobile
node ../../node_modules/jest/bin/jest.js --runInBand --testMatch '**/*.test.ts' '**/*.test.tsx'
```

Na raiz: `npm.cmd run mobile:lint`,
`node node_modules/typescript/bin/tsc --noEmit --project apps/mobile/tsconfig.json`,
`python -m unittest discover -s .github/scripts/tests -p 'test_*.py'` e
`node --test .github/scripts/tests/*.test.cjs`.
As mensagens de falha emitidas por fixtures Python são intencionais; as 24
asserções do conjunto terminaram aprovadas. Não foi gerado um novo APK neste ensaio.
