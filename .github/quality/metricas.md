# Métricas de qualidade do SmartCitys

Adaptado dos arquivos conceituais fornecidos pela equipe em `SmartCitys_parte_conceitual`.
Indicadores calculados a cada push/PR/manual do workflow unitário e a cada regressão diária/manual.
Os dois workflows têm escopos diferentes: seus resultados não devem ser comparados como suítes equivalentes.

| Métrica | Cálculo e fonte | Justificativa |
|---|---|---|
| Quantidades por suíte | Casos aprovados, reprovados e ignorados de Jest/Vitest/JUnit Maestro | Explicita abrangência e lacunas. |
| Taxa de aprovação | Aprovados / (aprovados + falhos) × 100 | Resume o resultado observado, não estabilidade histórica. |
| Taxa de falha | Falhos / (aprovados + falhos) × 100 | Complementa a aprovação e facilita a comunicação. |
| Cobertura | Linhas, branches, funções e statements do JSON summary do Jest | Identifica código exercitado, sem prometer ausência de defeitos. |
| Duração por suíte | Tempo do processo mobile/API; script E2E; soma dos tempos JUnit somente como alternativa | Permite observar demora de feedback, com escopos explícitos. |
| Tempo até o relatório | Do início da coleta após checkout até gerar os relatórios | Inclui preparação/build; exclui provisionamento do runner, upload e encerramento. Não é duração total do workflow. |
| Completude | Existência/validade dos resultados, exit code e outcome das etapas | Diferencia ausência de evidência de aprovação. |

Ignorados/todo/pending não entram no denominador de executados. Sem testes executados, taxas são `null` no JSON e N/D no HTML, nunca 100%.
Testes com erro de carregamento/infraestrutura não são inventados como casos funcionais reprovados.
A saída normalizada XML pode conter um caso sintético de erro de infraestrutura; esses casos não entram nas métricas funcionais.
As taxas agregadas têm peso por caso, não por suíte. Se a coleta estiver incompleta, os percentuais são parciais.
Reexecutar um workflow gera outro snapshot identificado por run ID e tentativa; não há média histórica automática nesta entrega.

## Cobertura: escopo e interpretação

O Jest já define `src/features/occurrences/**/*.{ts,tsx}`, excluindo os testes e `ApiOccurrenceService.ts`.
Esta entrega respeita esse escopo sem mudar a aplicação. API, autenticação, mapa, E2E e infraestrutura não devem ser apresentados como cobertos por esse percentual.
Os helpers dentro de `__tests__` também entram na configuração atual, pois não têm sufixo `.test`; essa limitação deve ser considerada ao interpretar a cobertura.
Não calculamos média entre percentuais de suítes nem convertê-los em “percentual de qualidade”.
Cobertura ausente é N/D. Meta inicial de atenção: 70% **em cada dimensão instrumentada**.
Meta é um indicador consultivo; não muda o critério atual de aprovação dos testes.
Erros na própria instrumentação/coleta são falhas da validação.

## Critérios determinísticos dos relatórios

1. **Vermelho:** pelo menos um caso reprovado, mesmo com taxa de aprovação de 99%.
2. **Inconclusivo:** nenhum caso reprovado registrado, mas preparação/execução/coleta incompleta ou zero executados.
3. **Amarelo:** execução completa sem falhas, porém cobertura indisponível/abaixo de 70% em alguma dimensão ou testes ignorados.
4. **Verde:** execução completa, ao menos um caso executado, sem falhas/ignorados e cobertura nas quatro dimensões ≥ 70%.

Caso haja falhas e coleta parcial, prevalece vermelho, mantendo o alerta de incompletude.
Na pipeline, qualquer falha de teste ou infraestrutura continua resultando em falha; amarelo não bloqueia por si só.
A meta conceitual de 95% não foi adotada como autorização de entrega: cinco falhas críticas em cem testes não são aceitáveis só pelo percentual.
Não inferimos criticidade pelo nome do teste. Uma classificação por jornada/criticidade exige um catálogo aprovado e será evolução futura.
O E2E aparece como suíte e os casos Maestro aparecem nos detalhes; não inventamos um indicador por tela se o XML contém apenas o fluxo completo.

## Métricas não selecionadas

| Métrica | Motivo da exclusão nesta etapa |
|---|---|
| Quantidade de commits | Mede atividade e organização, não correção. |
| Linhas de código e quantidade de arquivos | Tamanho não indica qualidade. |
| Total bruto de issues | Mistura defeitos, infraestrutura, dúvidas e tarefas; não é medida direta de qualidade. |
| Complexidade estática | Útil, mas requer outro instrumento e critérios; fora do foco desta atividade. |
| Disponibilidade, latência e carga em produção | Não medidas pelos testes atuais; exigem observabilidade e ensaios próprios. |
| Satisfação do usuário | Exige pesquisa/aceite, não pode ser deduzida de testes aprovados. |
| Flakiness e tendência de cobertura/duração | Uma execução não distingue instabilidade de regressão; exige histórico comparável. |

Ausência de média histórica não impede atualização dos indicadores por execução: JSON, resumo e HTML são gerados automaticamente a cada run relevante.

## M2 — interpretação dos resultados e riscos

Os relatórios técnico e de negócio, o `summary.md` publicado no Job Summary e
o `metrics.json` incluem a interpretação dos números e o diagnóstico por falha.

- **Razão de aprovação:** o texto apresenta aprovados/executados e explica o
  alcance dessa proporção. Uma taxa de 99% com uma falha mantém o resultado
  vermelho; 100% com coleta parcial não aprova a validação. Ignorados ficam
  fora do denominador. Sem execução, a razão permanece N/D.
- **Falhas do SUT:** o relatório identifica cada caso classificado como defeito
  do produto por parecer revisado, com diagnóstico, evidência e risco residual.
  A mensagem de erro e o nome do teste não determinam a causa automaticamente.
- **Risco que permanece:** o texto identifica falhas sem diagnóstico, casos
  ignorados, suítes incompletas, cobertura insuficiente e jornadas fora do
  escopo. Mesmo uma execução verde mantém explícitos os limites da evidência.

### Registrar o diagnóstico após a triagem

O arquivo versionado `failure-assessments.json` começa com `[]`, sem diagnósticos
inventados. Após investigar uma falha conforme `docs/tas.md`, o mantenedor
registra um parecer por PR, com revisão de um colega:

```json
[
  {
    "suite": "api",
    "test": "Nome exato do teste no metrics.json",
    "failure_sha256": "Copiar o failure_sha256 da falha no metrics.json",
    "cause": "sut",
    "diagnosis": "Descrever o requisito violado e a reprodução que confirmou a causa.",
    "evidence": "https://github.com/Lobiroka/SmartCitys/issues/NUMERO",
    "reviewer": "Login do colega que revisou o diagnóstico",
    "residual_risk": "Descrever a jornada afetada e o risco até corrigir e validar."
  }
]
```

O exemplo contém campos a substituir; não deve ser copiado como diagnóstico real.
O campo `cause` aceita `sut`, `automation`, `environment` ou `expected-change`.
As suítes aceitas são `mobile`, `api` e `e2e`. Evidência HTTPS, diagnóstico,
revisor e risco residual são obrigatórios em todas as classificações.

O gerador lê o arquivo automaticamente nos workflows existentes. Aplica o
parecer somente quando suíte, nome do teste e SHA-256 da mensagem sanitizada
coincidem. O hash está em `failure_assessments` no `metrics.json` gerado e evita
reutilizar um diagnóstico quando a mensagem da falha muda. Mudanças nos logs
ou na stack podem exigir nova triagem; a coincidência do hash não substitui
revisão humana nem comprova que todas as causas foram eliminadas.

Falhas sem parecer correspondente aparecem como **Triagem pendente**. Pareceres
incompletos, inválidos ou duplicados não são aplicados; o relatório registra o
problema e mantém a classificação pendente. Nenhuma classificação transforma
um teste reprovado em aprovado, encerra issues ou aceita riscos automaticamente.

Para reprocessar evidências já coletadas com um arquivo de pareceres específico,
o gerador também aceita `--assessments caminho/pareceres.json`. A coleta não
consulta o GitHub para confirmar os diagnósticos; o nome do revisor e os links
são registros humanos versionados e sujeitos à revisão da PR.
