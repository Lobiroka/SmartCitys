const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function execute(file, http, output = {}) {
  const context = {
    MAESTRO_E2E_API_URL: 'https://api.example.test/',
    MAESTRO_E2E_GESTOR_TOKEN: 'fixture-token',
    MAESTRO_E2E_TITLE: 'E1-unique',
    http, output, json: JSON.parse,
  };
  const source = fs.readFileSync(path.resolve(__dirname, '../../../.maestro/scripts', file), 'utf8');
  vm.runInNewContext(source, context);
  return output;
}

function page(data, totalPages = 1) {
  return { status: 200, body: JSON.stringify({ data, pagination: { totalPages } }) };
}

const created = { id_denuncia: 42, titulo: 'E1-unique', status: 'ABERTA' };

test('E1 rejeita gestor não autorizado antes de registrar a ocorrência', () => {
  assert.throws(() => execute('validate-manager.js', {
    get: () => ({ status: 403 }),
  }), /sem autorização/);
});

test('E1 encontra por título único em páginas posteriores, sem selecionar o primeiro registro', () => {
  const urls = [];
  const result = execute('find-occurrence.js', {
    get(url) {
      urls.push(url);
      return urls.length === 1
        ? page([{ ...created, titulo: 'registro de outro usuário' }], 2)
        : page([created], 2);
    },
  });
  assert.equal(result.e1OccurrenceId, 42);
  assert.match(urls[1], /page=2$/);
});

for (const [name, records] of [
  ['ausente', []],
  ['duplicado', [created, { ...created, id_denuncia: 43 }]],
  ['já alterado', [{ ...created, status: 'RESOLVIDA' }]],
]) {
  test('E1 recusa registro ' + name + ' sem escolher um ID para alteração', () => {
    const output = {};
    assert.throws(() => execute('find-occurrence.js', {
      get: () => page(records),
    }, output), /exatamente uma ocorrência/);
    assert.equal(output.e1OccurrenceId, undefined);
  });
}

test('E1 não chama PATCH sem identificar o registro criado na execução', () => {
  let called = false;
  assert.throws(() => execute('update-occurrence-status.js', {
    request() { called = true; },
  }), /não identificado/);
  assert.equal(called, false);
});

test('E1 usa a rota autorizada do gestor e confere status e ID da resposta', () => {
  execute('update-occurrence-status.js', {
    request(url, config) {
      assert.equal(url, 'https://api.example.test/demands/gestor/42/status');
      assert.equal(config.method, 'PATCH');
      assert.equal(config.headers.Authorization, 'Bearer fixture-token');
      assert.deepEqual(JSON.parse(config.body), { status: 'EM_ANALISE' });
      return { status: 200, body: JSON.stringify({ denuncia: { id_denuncia: 42, status: 'EM_ANALISE' } }) };
    },
  }, { e1OccurrenceId: 42 });
  assert.throws(() => execute('update-occurrence-status.js', {
    request: () => ({ status: 200, body: JSON.stringify({ denuncia: { id_denuncia: 43, status: 'EM_ANALISE' } }) }),
  }, { e1OccurrenceId: 42 }), /mesma ocorrência/);
});
