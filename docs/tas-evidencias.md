# Evidências da implementação da política da TAS

Data: 18/11/2026. Política: [tas.md](tas.md).

## Caso real e encaminhamento

A [issue #6](https://github.com/Lobiroka/SmartCitys/issues/6) registra identificação da falha da regressão, correções no Gradle e no roteiro Maestro, links de validação e encerramento. A seção 7 da política distingue as causas e explicita que a intermitência observada no login não está comprovadamente resolvida. A política foi definida depois do incidente; não atribuímos cumprimento retroativo de prazos.

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
