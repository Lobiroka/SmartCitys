# Evidências da implementação da política da TAS

Data: 18/11/2026. Política: [tas.md](tas.md).

## Jornada integrada da entrega final — 22/11/2026

Na branch `mobile-entrega-final`, uma execução completa com dois Androids foi
aprovada: cadastro/login, ocorrência com foto e GPS, pesquisa/filtros, mudança de
status pela interface do gestor, push real e acompanhamento pelo cidadão.
Os três JUnits passaram em aproximadamente 6min44s, sobre o commit `bbd79c8`.
[Relatório, metadados, falhas anteriores e limites](tas-evidence/final-2026-11-22/README.md).
Validado em development com Metro; esse resultado não homologa um novo APK.

## Caso real e encaminhamento

A [issue #6](https://github.com/Lobiroka/SmartCitys/issues/6) registra identificação da falha da regressão, correções no Gradle e no roteiro Maestro, links de validação e encerramento. A seção 7 da política distingue as causas e explicita que a intermitência observada no login não está comprovadamente resolvida. A política foi definida depois do incidente; não atribuímos cumprimento retroativo de prazos.

## Diagnóstico real de 20/11/2026 — primeiro acesso do Chrome

A [execução 44722827927](https://github.com/Lobiroka/SmartCitys/actions/runs/44722827927)
falhou na espera pelo campo `username` do Keycloak. Unitários, API e geração do
APK passaram; o relatório e a etapa final refletiram a falha real do E2E.
O acompanhamento está na [issue #29](https://github.com/Lobiroka/SmartCitys/issues/29).

Os arquivos sanitizados `commands.json`, `failure.png`, `hierarchy.xml` e
`device-logcat.txt` mostram a apresentação inicial do Chrome sendo dispensada e
o retorno à tela de entrada do app antes da asserção. Nenhuma credencial havia
sido digitada. Classificação: TAS, no tratamento do estado inicial do navegador;
o fluxo precisa iniciar novamente a autenticação depois desse retorno.

A correção mantém a asserção de login e acrescenta uma espera por destino
conhecido (`username` ou `login-button`) e um único toque em `Entrar` se houver
retorno ao app, exclusivamente no ramo que dispensou a apresentação do Chrome.
Não há retry global nem alteração do produto. A aprovação da correção depende
de nova regressão completa; uma execução aprovada não comprova a eliminação de
outras causas de intermitência no login.

### Validação do patch da PR #30

As duas execuções abaixo validaram o commit
`b7b05a2ed482a82510cfc77dabb5cc0019a77793`, com emuladores limpos:

| Execução | APK | Resultado |
|---|---|---|
| [44742259462](https://github.com/Lobiroka/SmartCitys/actions/runs/44742259462) | Novo; build aprovado | 55 mobile, 26 API e 1 E2E aprovados; 6 testes existentes ignorados |
| [44745443284](https://github.com/Lobiroka/SmartCitys/actions/runs/44745443284) | Reutilizado da primeira execução, na mesma branch e após a checagem de compatibilidade | Mesmos resultados; diagnóstico adicional registrado antes de executar |

Os relatórios de ambas indicam 82 casos aprovados, zero reprovados e coleta
completa. O indicador permanece **AMARELO** pelas lacunas já sinalizadas, com
seis testes ignorados. Não comparar a duração total dessas execuções como
tendência, pois somente a primeira compilou um APK novo.

Os `commands.json` confirmam que a apresentação do Chrome e a espera por destino
conhecido foram exercitadas. Nas duas execuções, o Chrome prosseguiu ao formulário
e houve somente um toque inicial em `Entrar`; o ramo que reabre o login ficou
sem cobertura dinâmica nesses ensaios. Isso limita a evidência: os fluxos
completos passaram com a alteração, mas não se afirma reprodução do retorno ao
app em uma execução aprovada nem estabilidade global do login.

Relatórios: [primeira validação](https://github.com/Lobiroka/SmartCitys/actions/runs/44742259462/artifacts/14632951251)
e [diagnóstico adicional](https://github.com/Lobiroka/SmartCitys/actions/runs/44745443284/artifacts/14632613626).
A [PR #30](https://github.com/Lobiroka/SmartCitys/pull/30) permanece sujeita à
revisão antes da integração, conforme o item 1.6 da política da TAS.

## Simulação reproduzível dos mecanismos novos

Executado localmente:

```sh
node --test .github/scripts/tests/*.test.cjs
```

Resultado: **10 testes aprovados, zero falhas**, incluindo testes do notificador e da manutenção. A API do GitHub é simulada; estes resultados não representam criação de issues ou execução de workflows no serviço remoto.

| Identificação simulada | Procedimento e encaminhamento verificados |
|---|---|
| Issue `[TAS] Falha de login`, aberta sexta-feira 13/11/2026 às 12:00 UTC, sem classificação ou responsável | Recebe `tas:manutencao`, `tas:triagem`, `tas:p2`, atribuição ao mantenedor e comentário com triagem em 16/11 às 12:00 UTC e correção em 20/11 às 12:00 UTC. |
| Mesma demanda ainda sem diagnóstico em 17/11 | Recebe aviso de triagem vencida, sem encerrar ou alterar prazo. |
| Demanda classificada como ambiente/P1, atribuída a um desenvolvedor, vencida em 18/11 | Preserva causa e responsável; emite aviso de correção vencida. Reexecutar o mecanismo não duplica comentário de prazo nem aviso. |
| Labels P0 e P2 conflitantes | Adota P0 por urgência; correção em 24 horas corridas, incluindo fim de semana. A política exige remover o conflito na triagem. |
| Revisão semanal já encerrada | Não cria outra revisão para a mesma semana. |
| PR, issue encerrada ou revisão semanal | Não reabre nem trata como demanda de correção. |
| Falha de workflow em fork, PR, branch secundária ou execução aprovada | Notificador não escreve issues de falha na branch padrão. |

## Confirmação após integração

Os mecanismos novos dependem de integração na `main`. Depois disso, o mantenedor deve disparar **Manutenção da TAS** e registrar na revisão semanal os links da execução e da primeira demanda acompanhada. Esta confirmação remota ainda não faz parte das evidências locais acima.

O ensaio não modifica o SUT, não introduz erro proposital e não exige implantação AWS, APK ou teste de fotos.
