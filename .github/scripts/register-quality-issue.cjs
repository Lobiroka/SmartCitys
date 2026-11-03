// Só usa metadados da API do GitHub; não executa nem interpreta artefatos de testes.
module.exports = async function register({ github, context, core }) {
  const run = context.payload.workflow_run;
  const repository = context.payload.repository;
  if (run.conclusion !== 'failure' || run.head_branch !== repository.default_branch ||
      run.head_repository?.full_name !== repository.full_name || run.event === 'pull_request') return;
  const marker = `<!-- smartcitys-quality:${run.workflow_id}:default-branch -->`;
  const occurrence = `<!-- execution:${run.id}:${run.run_attempt} -->`;
  const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRunAttempt, {
    ...context.repo, run_id: run.id, attempt_number: run.run_attempt, per_page: 100,
  });
  const failures = jobs.filter(job => ['failure', 'timed_out', 'action_required'].includes(job.conclusion));
  const details = failures.map(job => {
    const steps = (job.steps || []).filter(step => step.conclusion === 'failure')
      .map(step => step.name.replace(/[\r\n]/g, ' '));
    return `- ${job.name}: ${job.conclusion}${steps.length ? `; etapas: ${steps.join(', ')}` : ''}`;
  }).join('\n') || '- Consulte os jobs e logs da execução para identificar a etapa interrompida.';
  const artifacts = await github.paginate(github.rest.actions.listWorkflowRunArtifacts, {
    ...context.repo, run_id: run.id, per_page: 100,
  });
  const artifactNames = artifacts.filter(a => !a.expired).map(a => `- ${a.name}`).join('\n') || '- Nenhum artefato disponível; a preparação/coleta pode ter falhado.';
  const body = `${marker}\n${occurrence}\n## Falha na validação automatizada\n\n` +
    `Workflow: ${run.name}\nBranch: ${run.head_branch}\nCommit: ${run.head_sha}\n` +
    `Execução: ${run.run_number}; tentativa: ${run.run_attempt}\nData: ${run.updated_at}\n\n` +
    `[Abrir execução, logs e baixar artefatos](${run.html_url})\n\n` +
    `### Etapas com falha\n${details}\n\n### Artefatos disponíveis\n${artifactNames}\n\n` +
    `Quando disponíveis, abra quality/technical.html, quality/business.html e quality/metrics.json no artefato qualidade.\n\n` +
    `Uma falha de pipeline pode ser de teste, infraestrutura ou coleta. Classificar a causa antes de atribuir defeito ao produto.\n\n` +
    `- [ ] Investigar a causa e registrar o diagnóstico\n- [ ] Corrigir e anexar execução de validação\n`;
  const issues = await github.paginate(github.rest.issues.listForRepo, {
    ...context.repo, state: 'open', creator: 'github-actions[bot]', per_page: 100,
  });
  const existing = issues.find(issue => !issue.pull_request && issue.body?.includes(marker));
  if (!existing) {
    const created = await github.rest.issues.create({ ...context.repo,
      title: `[Qualidade] Falha em ${run.name}`, body });
    core.info(`Issue criada: ${created.data.html_url}`);
    return;
  }
  if (existing.body?.includes(occurrence)) return;
  const comments = await github.paginate(github.rest.issues.listComments, {
    ...context.repo, issue_number: existing.number, per_page: 100,
  });
  if (comments.some(comment => comment.body?.includes(occurrence))) return;
  await github.rest.issues.createComment({ ...context.repo, issue_number: existing.number, body });
  core.info(`Nova ocorrência adicionada à issue #${existing.number}`);
};
