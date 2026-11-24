const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

// Apenas identidade e infraestrutura são substituídas; rotas, validação,
// autorização, transformação e tratamento de erros são os reais.
process.env.KEYCLOAK_ISSUER = 'https://keycloak.invalid/realms/test';
process.env.KEYCLOAK_AUDIENCE = 'test';
delete process.env.DATABASE_URL_ETL;
const tokens = require('../dist/config/verifyAccessToken');
tokens.verifyAccessToken = async (token) => {
  if (token === 'invalid') throw new Error('invalid');
  return { subject: 'test', roles: token === 'manager' ? ['gestor'] : ['cidadao'] };
};
const repository = require('../dist/repositories/neighborhoodIndicatorsRepository');
const realFind = repository.findNeighborhoodIndicators;
const metrics = require('../dist/services/metricsService');
const legacyKpis = { total: 2, byCategory: {}, byRegion: {}, byStatus: {}, updatedAt: 'test' };
metrics.getMetrics = async () => legacyKpis;
metrics.refreshMetricsCache = async () => legacyKpis;
const routes = require('../dist/routes/metricsRoutes').default;
const { errorMiddleware } = require('../dist/middlewares/errorMiddleware');
let server;
let base;
before(async () => {
  const app = express();
  app.use(routes);
  app.use(errorMiddleware);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
});
function request(path = '/metrics/indicators/neighborhoods', token = 'manager', method = 'GET') {
  return fetch(base + path, { method, headers: token ? { authorization: `Bearer ${token}` } : {} });
}

test('exige token válido e papel gestor antes de consultar a ETL', async () => {
  repository.findNeighborhoodIndicators = async () => assert.fail('Não deveria consultar');
  assert.equal((await request(undefined, null)).status, 401);
  assert.equal((await request(undefined, 'invalid')).status, 401);
  assert.equal((await request(undefined, 'citizen')).status, 403);
});

test('valida filtro, inclusive arrays e objetos, antes de consultar', async () => {
  repository.findNeighborhoodIndicators = async () => assert.fail('Não deveria consultar');
  for (const query of ['codigoBairro=', 'codigoBairro=abc', 'codigoBairro=123456789012345678901',
    'codigoBairro=1&codigoBairro=2', 'codigoBairro[x]=1']) {
    assert.equal((await request(`/metrics/indicators/neighborhoods?${query}`)).status, 400);
  }
});

test('consulta por código e preserva valores ausentes, zero, ano e data de extração', async () => {
  repository.findNeighborhoodIndicators = async (code) => {
    assert.equal(code, '261160605');
    return [{ codigo_bairro: code, bairro: 'Bairro de teste', populacao: null,
      domicilios_total: 10, domicilios_rede_geral: 0, percentual_rede_esgoto: 0,
      ano: 2010, data_extracao: new Date('2026-11-18T12:00:00Z') }];
  };
  const response = await request('/metrics/indicators/neighborhoods?codigoBairro=261160605');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { source: 'IBGE/SIDRA', total: 1, items: [{
    codigoBairro: '261160605', bairro: 'Bairro de teste', populacao: null,
    domiciliosTotal: 10, domiciliosRedeGeral: 0, percentualRedeEsgoto: 0,
    ano: 2010, dataExtracao: '2026-11-18T12:00:00.000Z',
  }] });
});

test('consulta sem filtro retorna lista vazia quando não há dados', async () => {
  repository.findNeighborhoodIndicators = async (code) => {
    assert.equal(code, undefined);
    return [];
  };
  const response = await request();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { source: 'IBGE/SIDRA', total: 0, items: [] });
});

test('falha do Neon retorna 503 sem expor detalhes e mantém as rotas de KPIs', async () => {
  repository.findNeighborhoodIndicators = async () => { throw new Error('postgresql://secret'); };
  const response = await request();
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'Indicadores da ETL temporariamente indisponíveis' });
  for (const [path, method] of [['/metrics', 'GET'], ['/metrics/refresh', 'POST']]) {
    const legacyResponse = await request(path, 'manager', method);
    assert.equal(legacyResponse.status, 200);
    assert.deepEqual(await legacyResponse.json(), legacyKpis);
  }
});

test('configuração ausente afeta apenas a consulta opcional', async () => {
  repository.findNeighborhoodIndicators = realFind;
  assert.equal((await request()).status, 503);
  assert.equal((await request('/metrics')).status, 200);
});
