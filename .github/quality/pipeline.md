# Pipeline de qualidade: operação e evidências

## Fluxo implementado

`Jest/Vitest/Maestro → JSON/XML + logs → normalização → métricas JSON → HTML técnico e negócio → artefatos → notificação de falha`.

- `.github/scripts/run-quality-tests.py`: executa os testes, transmite stdout/stderr, registra log, duração e exit code original.
- `.github/scripts/quality-report.py`: interpreta os resultados, converte casos para XML JUnit normalizado, calcula indicadores, preenche os templates HTML e escreve o resumo da execução.
- `.github/quality/technical.html` e `business.html`: modelos adaptados dos documentos conceituais da equipe. Texto de testes é escapado para HTML; listas são variáveis.
- `.github/workflows/qualidade-issues.yml`: após o encerramento com falha, cria/atualiza issue sem depender de o job de testes conseguir chegar ao último passo.

Nenhuma dependência nova de aplicação foi adicionada. Python usa apenas a biblioteca padrão; Jest e Vitest usam reporters existentes. Código mobile/backend e infraestrutura AWS não foram alterados por esta entrega.

## Onde encontrar os arquivos

Em **Actions → execução → Artifacts**, baixe `qualidade-unitarios-<run>-<tentativa>` ou `qualidade-regressao-<run>-<tentativa>` e extraia o ZIP inteiro:

- `quality/technical.html`: relatório técnico, casos falhos, coleta, cobertura e links para arquivos existentes.
- `quality/business.html`: indicadores, limites da evidência, riscos e recomendação determinística.
- `quality/metrics.json`: dados estruturados para auditoria/comparações futuras.
- `mobile/results.json`, `mobile/normalized.xml`, `mobile/tests.log`, `mobile/execution.json`.
- `mobile/coverage/coverage-summary.json` e arquivos LCOV/HTML, quando gerados.
- `api/results.json`, `api/results.xml`, `api/normalized.xml`, `api/tests.log`, `api/execution.json` na regressão.
- `e2e/results.xml`, diagnóstico, screenshot/hierarquia em falha e duração, quando o E2E iniciar.
- `service-logs/`: logs dos três serviços temporários, quando iniciados.

Artefatos de qualidade: 14 dias. Evidências E2E separadas: 7 dias. APK diagnóstico: 2 dias, como antes.
Os HTMLs são artefatos para download, não um site público. Não foi configurado Pages nem armazenamento permanente.

## Falhas e coleta

Etapas de relatório/upload usam `!cancelled()` para executarem após falhas normais. Saída de testes não é convertida em sucesso pelo coletor.
Falta de resultados gera relatório inconclusivo e falha do coletor, em vez de aprovação silenciosa.
Preparação, build, teste ou upload com falha mantêm o job com falha.
Cancelamento, encerramento abrupto do runner, timeout global ou falha antes do checkout podem impedir relatórios/artefatos; os logs do Actions e a notificação externa são a evidência restante. Nunca prometer coleta em todas as condições.
O script remove dos arquivos textuais os valores conhecidos de secrets passados ao passo e senhas em URLs PostgreSQL. Isso não sanitiza pixels de screenshots: use somente contas/dados de teste e revise evidências antes de divulgar.

## Issues automáticas

Ativam quando o novo workflow está na branch padrão. Aceitam **falhas da branch padrão, no próprio repositório, fora de eventos pull_request** dos workflows `Testes unitários` e `Regressão completa`.
Pushes/PRs de outras branches ainda geram relatórios, mas não issues; evita ruído e escrita privilegiada para código não integrado.
Permissão `issues: write` existe só no workflow notificador, com leitura de Actions/conteúdo. Ele carrega código da branch padrão, não baixa artefatos nem executa código do run com falha.
Uma issue aberta por workflow agrega ocorrências; o marcador de run/tentativa evita comentários repetidos. Concorrência é serializada.
Após encerramento manual, uma nova falha pode criar outra issue. Sucesso não fecha automaticamente a issue nem comprova que todas as causas foram corrigidas.
Detalhes incluem commit, branch, data, execução/tentativa, jobs/etapas falhos e nomes dos artefatos com link da execução.
Classificar a causa: falha de teste, ambiente ou instrumentação; a abertura de uma issue não declara automaticamente um bug do produto.

## Validação local e apresentação

```text
python -m unittest discover -s .github/scripts/tests -v
node --test .github/scripts/tests/quality-issue.test.cjs
```

Os testes locais de notificação usam uma API simulada; não criam issues reais.
Para coleta real no Linux, a partir da raiz: `python .github/scripts/run-quality-tests.py mobile`.
API requer dependências e banco **exclusivo de teste**: não apontar TEST_DATABASE_URL ao RDS da aplicação.

Antes da aula, após revisar e integrar os arquivos:

1. Executar o workflow unitário e conferir XML/JSON, log, cobertura e ambos os HTMLs.
2. Executar a regressão manual com os secrets de teste existentes e conferir API/E2E/logs dos serviços.
3. Em execução controlada aprovada pela equipe, introduzir uma asserção falha identificada como demonstração na branch padrão; registrar a issue criada e o artefato. Não usar `continue-on-error` para ocultar o resultado.
4. Repetir a falha e conferir atualização da mesma issue; corrigir a asserção e registrar uma execução aprovada.
5. Mostrar o documento de métricas, incluindo N/D, ignorados, escopo de cobertura e critérios de risco.

Esta alteração local não publica commits, dispara workflows nem cria uma falha deliberada no GitHub. Evidências reais de issues e execução Linux/E2E só existem após essa validação no repositório.

## Referências

- https://jestjs.io/docs/29.7/cli
- https://v4.vitest.dev/guide/reporters
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run
