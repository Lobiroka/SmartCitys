const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

function assertTestDatabase(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Configure DATABASE_URL do banco exclusivo de testes.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      url.pathname !== '/smartcitys_test') {
    throw new Error('E3 aceita somente PostgreSQL loopback com banco smartcitys_test.');
  }
}

async function createFixture(db) {
  const nonce = randomUUID();
  const fixture = {
    keycloakSub: 'e3-' + nonce,
    title: 'E3 foreign ' + nonce,
    description: 'E3 private ' + nonce,
    invalidDescription: 'E3 missing title ' + nonce,
  };
  const occurrence = await db.denuncia.create({
    data: {
      titulo: fixture.title,
      descricao: fixture.description,
      endereco: 'Rua de testes E3, 100',
      categoria: 'ILUMINACAO_PUBLICA',
      regiao: 'OUTRA',
      cidadao: { create: { keycloak_sub: fixture.keycloakSub } },
    },
  });
  return { ...fixture, id: occurrence.id_denuncia };
}

function validateFixture(fixture) {
  if (!Number.isInteger(fixture.id) || fixture.id < 1 ||
      !/^e3-[0-9a-f-]{36}$/.test(fixture.keycloakSub)) {
    throw new Error('Fixture E3 inválida; não alterar dados.');
  }
  const nonce = fixture.keycloakSub.slice(3);
  if (fixture.title !== 'E3 foreign ' + nonce || fixture.description !== 'E3 private ' + nonce ||
      fixture.invalidDescription !== 'E3 missing title ' + nonce) {
    throw new Error('Marcadores da fixture E3 inválidos.');
  }
}

async function verifyFixture(db, fixture) {
  validateFixture(fixture);
  const occurrence = await db.denuncia.findUnique({
    where: { id_denuncia: fixture.id }, include: { cidadao: true },
  });
  if (!occurrence || occurrence.cidadao.keycloak_sub !== fixture.keycloakSub ||
      occurrence.titulo !== fixture.title || occurrence.descricao !== fixture.description ||
      occurrence.status !== 'ABERTA') {
    throw new Error('E3: ocorrência alheia ausente ou alterada durante o teste.');
  }
  const invalidRecords = await db.denuncia.count({ where: { descricao: fixture.invalidDescription } });
  if (invalidRecords !== 0) throw new Error('E3: registro sem título foi persistido indevidamente.');
}

async function cleanupFixture(db, fixture) {
  validateFixture(fixture);
  await db.$transaction(async (tx) => {
    await tx.denuncia.deleteMany({
      where: { id_denuncia: fixture.id, cidadao: { keycloak_sub: fixture.keycloakSub } },
    });
    await tx.cidadao.deleteMany({ where: { keycloak_sub: fixture.keycloakSub } });
  });
}

async function main() {
  const operation = process.argv[2];
  if (!['create', 'verify', 'cleanup'].includes(operation)) {
    throw new Error('Use: node .github/scripts/e3-fixture.cjs create|verify|cleanup');
  }
  assertTestDatabase(process.env.DATABASE_URL);
  const file = path.resolve(__dirname, '../../test-results/e2e/e3-fixture.json');
  if (operation === 'create' && fs.existsSync(file)) {
    throw new Error('Já existe fixture E3: confira e limpe a execução anterior antes de continuar.');
  }
  const backendRequire = createRequire(path.resolve(__dirname, '../../apps/backend/demand-service/package.json'));
  const { PrismaClient } = backendRequire('@prisma/client');
  const db = new PrismaClient();
  try {
    if (operation === 'create') {
      const fixture = await createFixture(db);
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify(fixture), { flag: 'wx' });
      } catch (error) {
        await cleanupFixture(db, fixture);
        throw error;
      }
      await verifyFixture(db, fixture);
    } else {
      const fixture = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (operation === 'verify') await verifyFixture(db, fixture);
      else {
        await cleanupFixture(db, fixture);
        fs.unlinkSync(file);
      }
    }
  } finally {
    await db.$disconnect();
  }
}

module.exports = { assertTestDatabase, createFixture, validateFixture, verifyFixture, cleanupFixture };
if (require.main === module) {
  main().catch(() => {
    console.error('E3: preparação/verificação/limpeza falhou. Confira o banco local de testes e a fixture.');
    process.exitCode = 1;
  });
}
