# Política de manutenção da TAS — SmartCitys

Versão 1.0 · 18/11/2026 · Responsável inicial: Robson (GitHub `Lobiroka`).

## Objetivo e contexto

A solução de automação de testes (TAS) valida o sistema sob teste (SUT): aplicativo Android Expo/React Native, autenticação Keycloak e APIs do SmartCitys. Inclui Jest, Vitest, Maestro, preparação do APK, ambiente temporário da CI, coletores e relatórios. A regressão usa banco exclusivo de teste; nunca deve executar operações destrutivas no RDS da aplicação.

Esta política atende aos requisitos de manutenção apresentados na atividade: tratamento e encaminhamento de falhas, prioridades, responsabilidades, instabilidade, revisão e remoção. O texto integral do Capítulo 13 não foi disponibilizado para uma comparação seção por seção.

O MVP tem equipe pequena, distribuição Android preview e recursos limitados. Por isso adotamos triagem humana com evidência, responsáveis individuais e automações simples no GitHub. A política evita que repetir uma execução ou ignorar um teste transforme um defeito desconhecido em aprovação.

## 1. Identificar, investigar e encaminhar

1. Preservar link do workflow, SHA, tentativa, logs, resultado esperado/observado e artefatos. Os relatórios incluem `quality/metrics.json`, `technical.html` e `business.html`. Se a coleta não ocorrer, registrar a ausência e usar os logs do Actions; não declarar aprovação.
2. Abrir demanda pelo formulário **Manutenção da automação de testes**. Falhas dos workflows monitorados na `main`, fora de pull requests, já geram issue automática agregada por workflow. Falhas em outras branches, cancelamentos e timeouts que não resultem em `failure` exigem abertura manual quando precisarem de manutenção.
3. O mantenedor recebe a demanda inicialmente. Em até um dia útil, identifica impacto, escolhe prioridade, classifica a causa e atribui a pessoa que fará a correção. P0 exige atuação imediata. A classificação não é inferida automaticamente do nome do teste.
4. Reproduzir com o mesmo commit e condições registradas; verificar primeiro preparação, serviços, dados, permissões e coleta. Comparar esperado com requisito vigente. Registrar cada tentativa, incluindo aprovações após falha.
5. Encaminhar conforme a tabela. Se houver causas distintas na issue agregadora, abrir demandas filhas com responsável e prazo próprios e manter os links; não encerrar a agregadora com causa pendente.
6. Corrigir por branch e PR, vinculando issue, requisito/jornada e evidência anterior/posterior. O autor executa a verificação pertinente; um colega revisa a alteração antes da integração. Se não houver revisor disponível, manter pendente e registrar o impedimento.
7. Encerrar manualmente após comprovar a correção e registrar risco residual, aprovação e evidências. Sucesso posterior não encerra automaticamente uma issue.

| Causa | Label | Diagnóstico e encaminhamento |
|---|---|---|
| Ainda desconhecida | `tas:triagem` | Investigar sem atribuir o defeito ao produto. Remover esta label quando classificado. |
| SUT | `tas:sut` | Comportamento viola requisito vigente. Encaminhar ao desenvolvedor da funcionalidade; preservar o teste que demonstra o defeito. |
| TAS | `tas:automacao` | Seletor, asserção, fixture, sincronização, coleta ou roteiro incorreto. Encaminhar ao mantenedor dos testes. |
| Ambiente | `tas:ambiente` | JVM, emulador, serviço, rede, configuração ou dependência. Encaminhar ao responsável de infraestrutura/CI. |
| Variação esperada | `tas:variacao-esperada` | Mudança aprovada de requisito, mensagem ou contrato. Vincular a decisão/PR e revisar o teste com o dono da funcionalidade. Sem aprovação, continuar investigando. |

Mais de uma causa pode ser registrada quando comprovada. Nunca ajustar a asserção apenas para fazer o teste passar. Evidências compartilhadas devem omitir credenciais e dados pessoais; screenshots exigem revisão humana.

## 2. Prioridades, responsabilidades e prazos

| Prioridade | Critério | Prazo de correção |
|---|---|---|
| P0 — crítica | Risco de perda/exposição de dados ou TAS aprova indevidamente uma jornada crítica | 24 horas corridas; interromper a distribuição afetada até avaliação |
| P1 — alta | Impede validar login, criação/consulta de ocorrência ou logout; regressão completa indisponível | 2 dias úteis |
| P2 — normal | Problema localizado, instabilidade sem perda total de cobertura ou melhoria necessária da TAS | 5 dias úteis |
| P3 — baixa | Refatoração ou documentação sem efeito imediato na confiança do resultado | 10 dias úteis |

Triagem: até um dia útil da abertura, com atuação imediata em P0. Os prazos contam da criação da issue, em UTC, mantendo a hora; dias úteis são segunda a sexta, sem calendário de feriados. A equipe pode antecipar qualquer prazo. Atribuição inicial: dono do repositório (`Lobiroka` neste projeto); ele encaminha ao implementador da causa e registra um revisor. Alterações de responsável não reiniciam o prazo.

A automação começa com `tas:p2`, que é provisória. Na triagem, ajustar para exatamente uma label de prioridade. Se houver conflito, o cálculo usa a mais urgente e a revisão deve remover o conflito. Alterar a prioridade recalcula o prazo a partir da abertura; justificar no histórico, sem apagar o atraso anterior. Prazos são metas operacionais e não garantias de disponibilidade.

Impedimento ou atraso: registrar causa, impacto, responsável e plano com previsão. Escalar a Robson no mesmo dia útil; a automação comenta a pendência, mas não prorroga nem encerra. Para P0/P1, manter bloqueada a distribuição da parte afetada enquanto não houver validação ou decisão explícita de risco pela equipe. O indicador de cobertura ou uma taxa alta de aprovação não libera uma jornada que falhou.

## 3. Gestão de testes instáveis

Uma falha seguida de sucesso no mesmo commit e condições comparáveis é suspeita de intermitência, não comprovação de correção. Aplicar `tas:instavel`, preservar ambas as tentativas e investigar sincronização, isolamento, dados, rede, emulador e permissões.

- Permitir uma reexecução diagnóstica controlada, vinculada à tentativa original. Outras repetições só com hipótese e justificativa na issue; não repetir até obter verde.
- Uma reexecução aprovada não apaga a falha nem encerra a investigação. Relatórios continuam separados por tentativa. Comparar o mesmo escopo e configuração; reutilizar APK apenas quando o mecanismo de compatibilidade existente aprovar.
- Preferir espera por condição verificável a pausas fixas. Isolar dados por teste e limpar somente dados do ambiente de teste. Não enfraquecer uma asserção para esconder erro do SUT.
- Quarentena é excepcional: exige issue, `tas:quarentena`, justificativa, aprovador distinto do autor, responsável, cobertura alternativa/manual e data de retorno de no máximo 5 dias úteis. Registrar no código do teste ignorado o número da issue. Jornada crítica sem alternativa permanece bloqueante.
- Quarentena não conta como teste aprovado. A issue permanece aberta e o resultado ignorado continua visível; a revisão semanal verifica o prazo. Não há mecanismo automático que desabilite testes.
- Retorno: PR com causa/correção documentada e três execuções consecutivas aprovadas em condições equivalentes, sem retries ocultos. Remover o ignore e as labels de instabilidade/quarentena após revisão. Três aprovações são critério de retorno, não garantia estatística de estabilidade.

## 4. Revisão periódica

O workflow **Manutenção da TAS** roda às 12:00 UTC (09:00 em Brasília), de segunda a sexta, ou manualmente. Verifica prazos e abre uma issue por semana, atribuída ao mantenedor. Concluir a revisão semanal até sexta-feira, registrando evidências e ações. O agendamento do GitHub pode sofrer atraso; o mantenedor confere a execução e usa o disparo manual se necessário.

| Aspecto | Critério de revisão e ação |
|---|---|
| Instabilidade | Revisar todas as falhas, reexecuções e quarentenas da semana. Resultado divergente comparável exige investigação, mesmo que o último run esteja verde. |
| Duração | Comparar últimas 10 execuções equivalentes e mediana das suítes. Aumento acima de 20% exige diagnóstico ou justificativa; não misturar build novo e APK reutilizado nem suítes distintas. Sem histórico suficiente, registrar N/D. |
| Duplicação | Inspecionar fixtures, preparação e roteiros alterados. Lógica equivalente em 3 ou mais lugares gera avaliação de extração de helper, preservando clareza e independência dos testes. |
| Rastreabilidade | Todo teste novo/alterado deve apontar requisito, jornada ou issue na PR. Revisar login/sessão, mapa, criação/consulta/edição e logout; registrar lacunas e testes ignorados. |
| Saúde operacional | Verificar prazos, responsáveis, falhas da coleta e execução do próprio notificador; não tratar ausência de relatório como sucesso. |
| Evidências | Artefatos de qualidade duram 14 dias. Registrar métricas relevantes e conclusões em issue ou documentação antes da expiração; não depender somente do ZIP temporário. |

A cada mês e após mudança relevante de framework, autenticação, API ou pipeline, revisar também esta política, dependências, catálogo de jornadas e necessidade de novos testes. Responsável: mantenedor, com revisão de um colega. Registrar decisão e PR na revisão semanal correspondente. Tendência, duplicação e rastreabilidade são revisadas por pessoas; não há detector automático de flakiness nem análise estática de duplicação nesta entrega.

## 5. Descontinuação de testes

Um teste pode ser removido quando: requisito foi oficialmente retirado; há cobertura equivalente comprovada por outro teste; ou a camada deixou de existir após alteração arquitetural. Lentidão ou instabilidade, isoladamente, exigem manutenção antes de remoção.

A PR de remoção deve identificar teste e requisito, motivo, cobertura substituta (ou lacuna aceita), riscos, issue de origem e evidências. Aprovação: mantenedor da TAS e dono da funcionalidade, com pelo menos um revisor diferente do autor. Se a remoção deixar uma jornada crítica sem verificação, não aprovar até definir alternativa e registrar a decisão de risco. O histórico do Git preserva o teste e a decisão; desativação temporária segue as regras de quarentena, não as de remoção.

## 6. Recursos implementados no GitHub

- `.github/ISSUE_TEMPLATE/tas-maintenance.yml`: formulário com evidência, impacto/jornada, hipótese e critério de encerramento.
- `.github/workflows/qualidade-issues.yml` e `register-quality-issue.cjs`: falhas monitoradas criam issue com labels e responsável inicial; ocorrências repetidas são agregadas sem duplicar o mesmo run/tentativa.
- `.github/workflows/tas-maintenance.yml` e `tas-maintenance.cjs`: criam labels ausentes, completam triagem/responsável/prioridade, publicam datas, avisam atrasos sem comentários repetidos e abrem a revisão semanal. Nenhuma classificação de causa é inventada.
- Eventos de issue permitem atender demandas manuais. As issues criadas pelo `GITHUB_TOKEN` do notificador são tratadas diretamente pelo próprio notificador, pois suas escritas não disparam novos workflows. As demais demandas abertas são revisitadas pelo agendamento.
- Testes Node validam prazos, fim de semana, prioridade conflitante, preservação do responsável, idempotência e alertas. O workflow unitário executa esses testes junto aos testes do notificador; os testes Python continuam validando coleta/relatórios.
- Não há fechamento automático, desativação de teste ou aceitação automática de risco. O workflow usa somente código da branch padrão e metadados de issues, sem executar texto ou artefatos enviados por usuários.

**Ativação:** integrar estes arquivos na `main`. Os eventos e o agendamento passam a usar a política integrada; para não esperar o próximo horário, disparar **Manutenção da TAS → Run workflow**. Conferir labels, atribuição, comentário de prazo e revisão semanal. A branch local não ativa recursos remotos. Alterar labels de uma demanda existente também aplica os procedimentos; a automação não reabre issues encerradas.

## 7. Demonstração real: regressão Android e issue #6

Evidência histórica: [issue #6 — Falha em Regressão completa](https://github.com/Lobiroka/SmartCitys/issues/6), encerrada; [PR #11](https://github.com/Lobiroka/SmartCitys/pull/11), com as correções. Esta ocorrência antecede a política; a classificação e os prazos abaixo são uma aplicação retrospectiva, não prova de cumprimento de SLA na época.

| Etapa | Aplicação ao caso |
|---|---|
| Identificação | Regressão interrompida por falta de Metaspace no Gradle e sem evidência completa de E2E. A issue automática registrou execução, etapas e artefatos. |
| Classificação | `tas:ambiente`: JVM/build; `tas:automacao`: permissão de notificações bloqueava o roteiro e mensagem esperada do formulário estava desatualizada. A falha intermitente na abertura do login deve permanecer distinguida das causas corrigidas. |
| Prioridade e encaminhamento | P1 pela indisponibilidade da regressão completa; mantenedor de CI/TAS corrige configuração e roteiro, com revisão por PR. Pela política atual: triagem em 1 dia útil e correção em 2, sem afirmar esses prazos como medidos no caso histórico. |
| Correção | `org.gradle.jvmargs` configurado com `-Xmx4g -XX:MaxMetaspaceSize=1g`; permissão de notificações concedida no roteiro e mensagem esperada alinhada ao formulário. |
| Evidência de build | [Execução 43904618152](https://github.com/Lobiroka/SmartCitys/actions/runs/43904618152) compilou o APK após a correção da memória e revelou o bloqueio de permissão no E2E. |
| Evidência posterior | [Execução 43909294454, tentativa 2](https://github.com/Lobiroka/SmartCitys/actions/runs/43909294454/attempts/2) aprovou unitários, API e E2E, incluindo logout; [artefato de métricas](https://github.com/Lobiroka/SmartCitys/actions/runs/43909294454/artifacts/14248970094), sujeito a expiração. |
| Encerramento e risco residual | A issue foi encerrada com links das correções e validação. A tentativa aprovada após falha intermitente não demonstra resolução definitiva da instabilidade do login. Pela política nova, abrir acompanhamento específico e exigir o critério de retorno antes de declarar estabilidade. |

Esta demonstração registra identificação, investigação, encaminhamento e validação sem introduzir defeito proposital na aplicação. Não apresenta a execução histórica como validação de alterações futuras.

## 8. Verificação da implementação

Executar na raiz:

```sh
node --test .github/scripts/tests/*.test.cjs
python -m unittest discover -s .github/scripts/tests -v
```

Os testes usam API simulada e não abrem issues nem alteram o ambiente AWS. Para validar a ativação remota após integração, usar uma demanda identificada como simulação, conferir classificação/assignee/prazo e registrar o encaminhamento e conclusão na própria issue. Não provocar falha funcional na `main`.

Documentos complementares: [evidências desta implementação](tas-evidencias.md), [operação da pipeline](../.github/quality/pipeline.md) e [métricas](../.github/quality/metricas.md).
