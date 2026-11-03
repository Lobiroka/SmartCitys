const test = require('node:test');
const assert = require('node:assert/strict');
const register = require('../register-quality-issue.cjs');

function fixture() {
  const calls = [];
  const methods = Object.fromEntries(['jobs', 'artifacts', 'issues', 'comments'].map(key => [key, { key }]));
  const context = { repo: { owner: 'example', repo: 'app' }, payload: {
    repository: { full_name: 'example/app', default_branch: 'main' },
    workflow_run: { conclusion: 'failure', head_branch: 'main', event: 'push',
      head_repository: { full_name: 'example/app' }, workflow_id: 3, id: 42,
      run_attempt: 1, run_number: 7, name: 'Testes unitários', head_sha: 'abc',
      html_url: 'https://github.com/example/app/actions/runs/42', updated_at: '2026-11-03' }
  }};
  const data = { jobs: [{ name: 'Testes', conclusion: 'failure', steps: [{name: 'Executar testes', conclusion: 'failure'}] }], artifacts: [{name: 'qualidade-unitarios-42-1', expired: false}], issues: [], comments: [] };
  const github = { rest: {
    actions: { listJobsForWorkflowRunAttempt: methods.jobs, listWorkflowRunArtifacts: methods.artifacts },
    issues: { listForRepo: methods.issues, listComments: methods.comments,
      create: async value => { calls.push(['create', value]); return {data: {html_url: 'issue-url'}}; },
      createComment: async value => { calls.push(['comment', value]); } }
  }, paginate: async (method) => data[method.key] };
  return { github, context, core: {info() {}}, data, calls };
}

test('cria issue com rastreabilidade e artefatos', async () => {
  const f = fixture(); await register(f);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0][0], 'create');
  assert.match(f.calls[0][1].body, /execution:42:1/);
  assert.match(f.calls[0][1].body, /Executar testes/);
  assert.match(f.calls[0][1].body, /qualidade-unitarios-42-1/);
});
test('nova falha atualiza issue existente', async () => {
  const f = fixture(); f.data.issues = [{number: 8, body: '<!-- smartcitys-quality:3:default-branch -->'}];
  await register(f); assert.equal(f.calls[0][0], 'comment');
  assert.equal(f.calls[0][1].issue_number, 8);
});
test('reexecução da notificação é idempotente', async () => {
  const f = fixture(); f.data.issues = [{number: 8, body: '<!-- smartcitys-quality:3:default-branch -->'}];
  f.data.comments = [{body: '<!-- execution:42:1 -->'}];
  await register(f); assert.equal(f.calls.length, 0);
});
test('não escreve para fork, PR, branch secundária ou sucesso', async () => {
  for (const changes of [{head_branch: 'feature'}, {conclusion: 'success'}, {event: 'pull_request'}, {head_repository: {full_name: 'fork/app'}}]) {
    const f = fixture(); Object.assign(f.context.payload.workflow_run, changes);
    await register(f); assert.equal(f.calls.length, 0);
  }
});
