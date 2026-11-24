const { test } = require('node:test');
const assert = require('node:assert/strict');
const etl = require('../dist/lib/etlPrisma');
const { findNeighborhoodIndicators } = require('../dist/repositories/neighborhoodIndicatorsRepository');

test('usa transação somente leitura, timeout e parâmetro SQL separado', async () => {
  const statements = [];
  etl.getEtlPrisma = () => ({
    $transaction: async (run, options) => {
      assert.deepEqual(options, { maxWait: 5000, timeout: 6000 });
      return run({
        $executeRaw: async (statement) => statements.push(statement.join('')),
        $queryRaw: async (query) => {
          assert.match(query.text, /FROM public\.recife_populacao_saneamento/);
          assert.match(query.text, /WHERE codigo_bairro = \$1/);
          assert.deepEqual(query.values, ["1' OR '1'='1"]);
          return [];
        },
      });
    },
  });
  assert.deepEqual(await findNeighborhoodIndicators("1' OR '1'='1"), []);
  assert.deepEqual(statements, ["SET TRANSACTION READ ONLY", "SET LOCAL statement_timeout = '4s'"]);
});

test('sem filtro consulta a tabela qualificada sem parâmetros', async () => {
  etl.getEtlPrisma = () => ({
    $transaction: async (run) => run({
      $executeRaw: async () => {},
      $queryRaw: async (query) => {
        assert.doesNotMatch(query.text, /WHERE/);
        assert.deepEqual(query.values, []);
        return [];
      },
    }),
  });
  assert.deepEqual(await findNeighborhoodIndicators(), []);
});
