const assert = require('node:assert/strict');
const test = require('node:test');
const {
  assertTestDatabase, createFixture, verifyFixture, cleanupFixture,
} = require('../e3-fixture.cjs');

function scenario() {
  let record;
  const deleted = [];
  const db = {
    denuncia: {
      async create({ data }) {
        record = {
          ...data, id_denuncia: 42, status: 'ABERTA',
          cidadao: { keycloak_sub: data.cidadao.create.keycloak_sub },
        };
        return record;
      },
      async findUnique() { return record; },
      async count() { return 0; },
      async deleteMany(query) { deleted.push(['occurrence', query]); },
    },
    cidadao: {
      async deleteMany(query) { deleted.push(['citizen', query]); },
    },
    async $transaction(callback) { return callback(db); },
  };
  return { db, deleted, get record() { return record; } };
}

test('E3 aceita banco exclusivo local e rejeita RDS, outros bancos e protocolo inválido', () => {
  assert.doesNotThrow(() => assertTestDatabase('postgresql://user:pass@localhost:5434/smartcitys_test?schema=demand'));
  for (const url of [undefined, 'https://localhost/smartcitys_test',
    'postgresql://user:pass@rds.example.test/smartcitys_test',
    'postgresql://user:pass@127.0.0.1/smartcitys_dev']) {
    assert.throws(() => assertTestDatabase(url));
  }
});

test('E3 prepara registro de dono sintético e verifica sua existência', async () => {
  const state = scenario();
  const fixture = await createFixture(state.db);
  assert.match(fixture.keycloakSub, /^e3-/);
  assert.ok(fixture.title.length <= 50);
  await verifyFixture(state.db, fixture);
});

test('E3 não aceita 404 para um registro que já não existe', async () => {
  const state = scenario();
  const fixture = await createFixture(state.db);
  state.db.denuncia.findUnique = async () => null;
  await assert.rejects(verifyFixture(state.db, fixture), /ausente ou alterada/);
});

test('E3 reprova alteração indevida ou persistência sem título', async () => {
  const state = scenario();
  const fixture = await createFixture(state.db);
  state.record.status = 'EM_ANALISE';
  await assert.rejects(verifyFixture(state.db, fixture), /ausente ou alterada/);
  state.record.status = 'ABERTA';
  state.db.denuncia.count = async () => 1;
  await assert.rejects(verifyFixture(state.db, fixture), /persistido indevidamente/);
});

test('E3 limita a limpeza ao ID e dono da própria fixture', async () => {
  const state = scenario();
  const fixture = await createFixture(state.db);
  await cleanupFixture(state.db, fixture);
  assert.deepEqual(state.deleted, [
    ['occurrence', { where: { id_denuncia: 42, cidadao: { keycloak_sub: fixture.keycloakSub } } }],
    ['citizen', { where: { keycloak_sub: fixture.keycloakSub } }],
  ]);
});

test('E3 não apaga registros com manifesto adulterado', async () => {
  const state = scenario();
  const fixture = await createFixture(state.db);
  await assert.rejects(cleanupFixture(state.db, { ...fixture, keycloakSub: 'outro-usuario' }));
  await assert.rejects(cleanupFixture(state.db, { ...fixture, title: 'outro-titulo' }));
  assert.equal(state.deleted.length, 0);
});
