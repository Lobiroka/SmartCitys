const test = require('node:test');
const assert = require('node:assert/strict');
const { deadlines, maintainIssue, run } = require('../tas-maintenance.cjs');

function fixture() {
  const calls = [];
  const issue = { number: 4, title: '[TAS] Falha de login', state: 'open',
    created_at: '2026-11-13T12:00:00Z', labels: [], assignees: [] };
  const data = { comments: [], labels: [], issues: [] };
  const github = { rest: { issues: {
    listComments: 'comments', listLabelsForRepo: 'labels', listForRepo: 'issues',
    get: async () => ({ data: issue }),
    ...Object.fromEntries(['createComment', 'createLabel', 'addLabels', 'addAssignees', 'create'].map(method =>
      [method, async value => { calls.push({method, ...value}); }]))
  } }, paginate: async method => data[method] };
  return { github, context: { repo: { owner: 'example', repo: 'app' }, payload: {} },
    issue, data, calls, now: new Date('2026-11-13T13:00:00Z') };
}

test('prazos respeitam fim de semana, urgência e conflito de prioridade', () => {
  const f = fixture();
  let result = deadlines(f.issue);
  assert.equal(result.triage.toISOString(), '2026-11-16T12:00:00.000Z');
  assert.equal(result.correction.toISOString(), '2026-11-20T12:00:00.000Z');
  f.issue.labels = [{name: 'tas:p0'}, {name: 'tas:p2'}];
  result = deadlines(f.issue);
  assert.equal(result.priority, 'tas:p0');
  assert.equal(result.correction.toISOString(), '2026-11-14T12:00:00.000Z');
});

test('demanda nova recebe classificação pendente, responsável e prazo explícito', async () => {
  const f = fixture(); await maintainIssue(f);
  assert.deepEqual(f.calls.find(c => c.method === 'addLabels').labels,
    ['tas:manutencao', 'tas:triagem', 'tas:p2']);
  assert.deepEqual(f.calls.find(c => c.method === 'addAssignees').assignees, ['example']);
  assert.match(f.calls.find(c => c.method === 'createComment').body, /2026-11-20T12:00:00.000Z/);
});

test('não duplica prazo ou alerta e preserva classificação e responsável', async () => {
  const f = fixture();
  f.issue.labels = ['tas:manutencao', 'tas:ambiente', 'tas:p1'];
  f.issue.assignees = [{login: 'dev'}]; f.now = new Date('2026-11-18T13:00:00Z');
  await maintainIssue(f);
  assert.equal(f.calls.length, 2);
  assert.match(f.calls[1].body, /Prazo de correcao vencido/);
  f.data.comments = f.calls.map(c => ({body: c.body})); f.calls.length = 0;
  await maintainIssue(f); assert.equal(f.calls.length, 0);
});

test('avisa triagem vencida antes do prazo de correção', async () => {
  const f = fixture(); f.now = new Date('2026-11-17T12:00:00Z');
  await maintainIssue(f);
  assert.match(f.calls.at(-1).body, /Prazo de triagem vencido/);
});

test('ignora PRs, demandas encerradas e revisões', async () => {
  for (const change of [{pull_request: {}}, {state: 'closed'}, {labels: ['tas:revisao']}]) {
    const f = fixture(); Object.assign(f.issue, change); await maintainIssue(f);
    assert.equal(f.calls.length, 0);
  }
});

test('revisão semanal não é duplicada mesmo depois de encerrada', async () => {
  const f = fixture(); await run(f);
  const review = f.calls.find(c => c.method === 'create');
  assert.match(review.body, /tas-revisao:2026-11-09/);
  f.data.issues = [{body: review.body, state: 'closed', labels: ['tas:revisao']}];
  f.calls.length = 0; await run(f);
  assert.equal(f.calls.filter(c => c.method === 'create').length, 0);
});
