# Evidências da entrega final com mapa carregado — 23/11/2026

## Resultado

**Aprovado: três etapas, zero falhas, código de saída 0.** A jornada inteira foi
executada uma vez do início ao fim, com conta e ocorrência novas e sem retry
global, sobre o código [df7f4d7](https://github.com/Lobiroka/SmartCitys/commit/df7f4d7e7fe6e636a33109c0bae6fe0ad4d98593).

Execução `final-1f2a77a933ce404fbd42d81b3b1683aa`, em 23/11/2026, das
**00:21:57 às 00:28:34**, America/Sao_Paulo: aproximadamente **6min37s**.
As duas capturas iniciais mostram as ruas e os nomes dos lugares no mapa.

| Etapa | Resultado | Duração do executor | JUnit |
|---|---|---|---|
| Cadastro/login, mapa carregado, ocorrência com foto/GPS, filtros e reabertura | Aprovada | 273,845 s | [Cidadão](citizen-register-and-report.xml) |
| Gestor confere a mesma ocorrência e altera o status pela tela | Aprovada | 77,501 s | [Gestor](manager-update.xml) |
| Cidadão recebe push real e acompanha Em análise | Aprovada | 45,924 s | [Notificação](citizen-notification.xml) |

[JUnit agregado](results.xml), [metadados](execution.json),
[preparação e condições das capturas](preparation.json) e [hashes dos relatórios](sha256.json).
As durações do executor incluem a inicialização do Maestro e diferem dos tempos
de cenário no JUnit. A ocorrência fictícia validada foi a **#10**, identificada
pelo título único desta execução.

As sete capturas estão reunidas localmente em
`test-results/e2e/evidencias-mapa-2026-11-23/`:

1. `01-cadastro-concluido.png` — cadastro concluído e mapa carregado.
2. `02-login-cidadao.png` — novo login e mapa carregado.
3. `03-foto-gps-recarregados.png` — foto persistida na edição.
4. `04-gestor-foto-gps.png` — mesmo registro, foto e GPS no outro Android.
5. `05-gestor-status-salvo.png` — Em análise e confirmação de alteração salva.
6. `06-push-real-recebido.png` — notificação real no Android do cidadão.
7. `07-cidadao-status-atualizado.png` — mesmo registro em Em análise na lista.

Também permanecem os originais, sem alteração, nas pastas `takeScreenshot` de
`test-results/e2e/final-1f2a77a933ce404fbd42d81b3b1683aa/`. As imagens ficam
fora do Git até a revisão humana do responsável; os resultados textuais estão versionados.

## O que mudou

As capturas anteriores eram feitas logo após aparecer o menu do perfil, sem
aguardar o fundo do mapa. A chave já estava no APK e o mapa carregou no mesmo
emulador sem alterar credenciais ou restrições do Google.

O componente agora informa prontidão somente depois de `onMapLoaded` (tiles
renderizados), `onRegionChangeComplete` (câmera estabilizada) e localização
resolvida sem erro. A movimentação da câmera invalida esse estado até terminar.
O roteiro aguarda o identificador `main-map-loaded`, aguarda a estabilização
visual e confirma esse estado novamente antes das capturas de cadastro e login.
O prazo é explícito: 90 segundos para o estado carregado e até 15 segundos para
estabilização visual. Não há captura alternativa em caso de falha.

As exigências estão em `.maestro/flows/wait-map-loaded.yaml` e são usadas
somente pela jornada final com serviços reais. O fluxo básico da regressão
isolada não passou a depender de uma chave Google Maps válida.

## Ambiente e preparação

Branch `mobile-entrega-final`; Windows; Maestro CLI 2.12.1; APK development
`com.darkartsbm.smartcitys`; Metro; dois Androids API 36 separados para cidadão
(`emulator-5554`, `SmartCity_API_36`) e gestor (`emulator-5556`,
`SmartCity_Gestor_API_36`). API HTTPS e Keycloak compartilhados de testes.
Credenciais do gestor fornecidas pelo arquivo local ignorado; cidadão criado
pelo formulário real com credenciais geradas em memória.

O GPS virtual do cidadão recebe `-8.0476, -34.877` a cada três segundos durante
o ensaio. Essa é uma preparação do emulador: o app obtém as coordenadas pelo
serviço nativo de localização. Não há injeção de coordenadas na API nem troca
do serviço real por um mock. O envio periódico é encerrado ao terminar o teste.

A validação do formulário identifica o campo `occurrence-coordinates`, que fica
acima do botão de GPS. Após o toque, rola para cima e aguarda nesse campo valores
numéricos com seis casas decimais. Não basta encontrar um texto de localização
qualquer nem assumir que o toque já terminou a consulta ao Android.

Reprodução: seguir o [guia Maestro](../../../.maestro/README.md), incluindo o
terminal de atualização do GPS do emulador, antes de executar:

```powershell
npm.cmd run mobile:test:e2e:final -- `
  --citizen-device emulator-5554 --manager-device emulator-5556 `
  --credentials-file CAMINHO_LOCAL --dev-client
```

O fluxo limpa app e Chrome nos dispositivos dedicados. Não utilizar aparelhos
com dados ou sessões pessoais a preservar. Não é necessário compartilhar
credenciais AWS, Firebase Admin ou chave de compilação Maps para executar o Metro.

## Tentativa anterior preservada

`final-64f7cd1073d64636b65e4a95e3e8c915`, código `bfa6f01`, mostrou os mapas nas
duas capturas, mas o roteiro não encontrou as coordenadas GPS dentro do prazo.
Essa tentativa não foi aprovada nem reutilizada
como resultado completo. O código seguinte acrescenta a espera pela estabilização
da câmera, e a preparação passa a manter o GPS virtual atualizado.

Na retomada, o ADB estava sem responder, o Metro não estava disponível e o
emulador cidadão havia sido fechado. O ADB e o Metro foram reiniciados e o
emulador cidadão foi aberto sem snapshot, preservando seus dados.

`final-82a898110f044905a51a31d6219478c3` aprovou a etapa completa do cidadão,
incluindo as duas capturas do mapa carregado, foto e GPS. O emulador gestor,
porém, parou de responder a comandos e até à captura de tela. O Maestro dessa
tentativa foi interrompido e o relatório ficou reprovado, sem executar a etapa
de notificação. Os emuladores dedicados foram reiniciados sem snapshot e com
seus dados preservados para um novo ensaio integral sobre o mesmo código.

`final-bba88e81bccf4fc5b4f29a1344978579` voltou a falhar na confirmação visual
das coordenadas, apesar de o GPS virtual estar sendo atualizado. A inspeção da
tela e do código revelou a falha da TAS: o texto fica acima do botão, mas o
roteiro procurava rolando para baixo. Foi adicionado o identificador do campo,
corrigida a direção e separada a espera pelo valor. O serviço nativo de GPS do
app não foi modificado. A ausência do texto no roteiro não prova, isoladamente,
que o provedor de localização falhou.

O [ensaio anterior sem espera do mapa](../final-2026-11-22/README.md) permanece
preservado como histórico, com seus resultados e limites originais.

## Limites e publicação

Esta é uma validação Android development com Metro, não de um novo APK final.
A câmera e o GPS usam dados sintéticos do emulador; a imagem da câmera tem fundo
escuro e carimbo de data/hora. Uma execução aprovada não demonstra estabilidade
histórica nem substitui a conferência em aparelho físico.

Somente relatórios textuais e seus hashes são versionados. As sete capturas
permanecem locais para revisão humana do responsável antes de publicação no Git,
conforme a política da TAS. Logs brutos, senhas e tokens não são publicados.

## Verificações complementares

64 testes mobile aprovados, em 16 suítes; lint e TypeScript sem erros; sintaxe
Maestro e `git diff --check` aprovados. O Jest foi executado com padrões relativos
para contornar o problema de separadores do caminho deste worktree Windows,
conforme já descrito no relatório anterior. Nenhum teste foi desativado.
