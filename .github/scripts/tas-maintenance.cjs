// Trabalha apenas com metadados de issues; nunca executa conteúdo informado nelas.
const MAINTAINER = 'DarkArtsBM'; // Pessoa responsável; Lobiroka é a organização do projeto.
const LABELS = {
  'tas:manutencao': ['5319e7', 'Demanda de manutenção da automação de testes'],
  'tas:triagem': ['ededed', 'Causa ainda em investigação'],
  'tas:sut': ['d73a4a', 'Defeito no sistema sob teste'],
  'tas:automacao': ['0052cc', 'Defeito no código ou roteiro de teste'],
  'tas:ambiente': ['fbca04', 'Infraestrutura, dependências ou configuração'],
  'tas:variacao-esperada': ['c2e0c6', 'Mudança de comportamento aprovada e rastreada'],
  'tas:instavel': ['f9d0c4', 'Resultado intermitente que exige investigação'],
  'tas:quarentena': ['e99695', 'Exclusão temporária aprovada com prazo e cobertura alternativa'],
  'tas:revisao': ['bfdadc', 'Revisão semanal da TAS'],
  'tas:p0': ['b60205', 'Crítica: corrigir em 24 horas corridas'],
  'tas:p1': ['d93f0b', 'Alta: corrigir em 2 dias úteis'],
  'tas:p2': ['fbca04', 'Normal: corrigir em 5 dias úteis'],
  'tas:p3': ['0e8a16', 'Baixa: corrigir em 10 dias úteis'],
};

function businessDays(start, count) {
  const date = new Date(start);
  while (count > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (![0, 6].includes(date.getUTCDay())) count--;
  }
  return date;
}

function deadlines(issue) {
  const priorities = issue.labels.map(label => typeof label === 'string' ? label : label.name)
    .filter(label => /^tas:p[0-3]$/.test(label)).sort();
  const priority = priorities[0] || 'tas:p2'; // Em conflito prevalece a mais urgente.
  const start = new Date(issue.created_at);
  const correction = priority === 'tas:p0'
    ? new Date(start.getTime() + 86400000)
    : businessDays(start, { 'tas:p1': 2, 'tas:p2': 5, 'tas:p3': 10 }[priority]);
  return { priority, triage: businessDays(start, 1), correction };
}

async function ensureLabels(github, repo) {
  const current = await github.paginate(github.rest.issues.listLabelsForRepo, { ...repo, per_page: 100 });
  for (const [name, [color, description]] of Object.entries(LABELS)) {
    if (!current.some(label => label.name === name)) {
      await github.rest.issues.createLabel({ ...repo, name, color, description });
    }
  }
}

async function maintainIssue({ github, context, issue, now = new Date() }) {
  if (issue.pull_request || issue.state !== 'open') return;
  const names = issue.labels.map(label => typeof label === 'string' ? label : label.name);
  if (names.includes('tas:revisao')) return;
  if (!names.includes('tas:manutencao') && !issue.title.startsWith('[TAS]')) return;
  const additions = ['tas:manutencao'];
  if (!names.some(name => /^tas:(triagem|sut|automacao|ambiente|variacao-esperada)$/.test(name))) additions.push('tas:triagem');
  if (!names.some(name => /^tas:p[0-3]$/.test(name))) additions.push('tas:p2');
  const missing = additions.filter(name => !names.includes(name));
  if (missing.length) await github.rest.issues.addLabels({ ...context.repo, issue_number: issue.number, labels: missing });
  if (!issue.assignees?.length) {
    await github.rest.issues.addAssignees({ ...context.repo, issue_number: issue.number,
      assignees: [MAINTAINER] });
  }
  const due = deadlines(issue);
  const comments = await github.paginate(github.rest.issues.listComments, {
    ...context.repo, issue_number: issue.number, per_page: 100,
  });
  const marker = `<!-- tas-prazos:${due.priority}:${due.correction.toISOString()} -->`;
  if (!comments.some(comment => comment.body?.includes(marker))) {
    await github.rest.issues.createComment({ ...context.repo, issue_number: issue.number,
      body: `${marker}\nPolítica: [docs/tas.md](https://github.com/${context.repo.owner}/${context.repo.repo}/blob/main/docs/tas.md).\n` +
        `Prioridade: **${due.priority}**. Triagem até **${due.triage.toISOString()}**; correção até **${due.correction.toISOString()}**.\n` +
        'Prazos contados da abertura, em UTC; dias úteis excluem sábado e domingo. O responsável inicial é DarkArtsBM, que deve encaminhar ao dono da causa.\n' +
        '- [ ] Registrar classificação, diagnóstico e responsável\n- [ ] Vincular requisito/jornada, PR e evidências da correção\n- [ ] Revisar risco residual antes de encerrar' });
  }
  const triagePending = !names.some(name => /^tas:(sut|automacao|ambiente|variacao-esperada)$/.test(name));
  const late = now > due.correction ? 'correcao' : triagePending && now > due.triage ? 'triagem' : null;
  const lateMarker = `<!-- tas-atraso:${late}:${due.priority}:${due.correction.toISOString()} -->`;
  if (late && !comments.some(comment => comment.body?.includes(lateMarker))) {
    await github.rest.issues.createComment({ ...context.repo, issue_number: issue.number,
      body: `${lateMarker}\n**Prazo de ${late} vencido.** O responsável deve registrar impedimento, impacto e plano de resolução nesta issue. A automação não encerra nem prorroga a demanda.` });
  }
}

async function run({ github, context, now = new Date() }) {
  await ensureLabels(github, context.repo);
  if (context.payload.issue) {
    // Lê o estado atual para evitar reatribuir alguém removido ou usar labels antigas.
    const { data: issue } = await github.rest.issues.get({ ...context.repo, issue_number: context.payload.issue.number });
    await maintainIssue({ github, context, issue, now });
    return;
  }
  const issues = await github.paginate(github.rest.issues.listForRepo, {
    ...context.repo, state: 'open', labels: 'tas:manutencao', per_page: 100,
  });
  for (const issue of issues) await maintainIssue({ github, context, issue, now });
  // Uma issue por semana (segunda-feira UTC), inclusive se a execução for manual.
  const monday = new Date(now);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const marker = `<!-- tas-revisao:${monday.toISOString().slice(0, 10)} -->`;
  const reviews = await github.paginate(github.rest.issues.listForRepo, {
    ...context.repo, state: 'all', labels: 'tas:revisao', per_page: 100,
  });
  if (!reviews.some(issue => issue.body?.includes(marker))) {
    await github.rest.issues.create({ ...context.repo,
      title: `[TAS] Revisão semanal — ${monday.toISOString().slice(0, 10)}`,
      labels: ['tas:revisao'], assignees: [MAINTAINER],
      body: `${marker}\nAplicar [a política da TAS](https://github.com/${context.repo.owner}/${context.repo.repo}/blob/main/docs/tas.md). Concluir até sexta-feira desta semana.\n\n` +
        '- [ ] Revisar falhas, reexecuções, instáveis e quarentenas; abrir demandas com evidências\n' +
        '- [ ] Comparar duração das últimas 10 execuções equivalentes (atenção: aumento acima de 20%)\n' +
        '- [ ] Revisar duplicação em fixtures/helpers/roteiros e rastreabilidade por jornada/requisito\n' +
        '- [ ] Conferir responsáveis, prioridades, prazos e demandas vencidas\n' +
        '- [ ] Revisar testes ignorados/removidos e respectivos riscos e aprovações\n' +
        '- [ ] Preservar métricas e conclusões relevantes antes de expirarem os artefatos\n\n' +
        'Registrar links das execuções, decisões, riscos e próximas ações antes de encerrar. Sem histórico suficiente, registrar N/D e a lacuna.' });
  }
}

module.exports = { MAINTAINER, businessDays, deadlines, ensureLabels, maintainIssue, run };
