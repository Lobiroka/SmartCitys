const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { containsPoint } = require('../dist/utils/neighborhoodGeometry');
const repository = require('../dist/repositories/dashboardRepository');
const { buildDashboard, getDashboard } = require('../dist/services/dashboardService');

const square = (x = 0) => ({ type: 'Polygon', coordinates: [[[x,0],[x+1,0],[x+1,1],[x,1],[x,0]]] });
const row = (code, x, population = 100) => ({
  codigo_bairro: code, bairro: `Bairro ${code} - Recife - PE`, populacao: population,
  domicilios_total: 10, domicilios_rede_geral: 5, percentual_rede_esgoto: 50,
  ano: 2010, data_extracao: new Date('2026-11-18T12:00:00Z'),
  limites_data_extracao: new Date(), geometria: square(x),
});
const occurrence = (latitude, longitude, categoria = 'SANEAMENTO', status = 'ABERTA') => ({ latitude, longitude, categoria, status });

test('ponto em polígono: interior, exterior, borda, buraco e multipolígono', () => {
  assert.equal(containsPoint(square(), [0.5,0.5]), true);
  assert.equal(containsPoint(square(), [20,20]), false);
  assert.equal(containsPoint(square(), [0,0.5]), true);
  const hole = { type: 'Polygon', coordinates: [...square().coordinates, [[0.2,0.2],[0.8,0.2],[0.8,0.8],[0.2,0.8],[0.2,0.2]]] };
  assert.equal(containsPoint(hole, [0.5,0.5]), false);
  assert.equal(containsPoint({ type: 'MultiPolygon', coordinates: [square().coordinates, square(5).coordinates] }, [5.5,0.5]), true);
});

test('cruza por coordenadas e contabiliza casos sem coordenadas, fora e ambíguos', () => {
  const result = buildDashboard([
    occurrence(0.5,0.5), occurrence(0.5,0.5,'COLETA_DE_LIXO','RESOLVIDA'),
    occurrence(0.5,1.5), occurrence(null,null), occurrence(5,5), occurrence(0.5,1),
  ], [row('001',0), row('002',1,0)]);
  assert.equal(result.occurrences.total, 6);
  assert.equal(result.matchedOccurrences, 3);
  assert.deepEqual(result.unmatched, { withoutCoordinates: 1, outsideCoverage: 1, ambiguous: 1 });
  assert.equal(result.items[0].bairro, 'Bairro 001');
  assert.equal(result.items[0].occurrences.total, 2);
  assert.equal(result.items[0].occurrences.saneamento, 1);
  assert.equal(result.items[0].occurrences.byStatus.RESOLVIDA, 1);
  assert.equal(result.items[0].occurrencesPer10k, 200);
  assert.equal(result.items[1].occurrencesPer10k, null);
  assert.equal(result.items[0].ano, 2010);
  assert.equal('geometria' in result.items[0], false);
});

test('agregação inclui todos os registros, além da primeira página de 100', () => {
  const result = buildDashboard(Array.from({length: 150}, () => occurrence(0.5,0.5)), [row('001',0)]);
  assert.equal(result.matchedOccurrences,150);
  assert.equal(result.items[0].occurrences.total,150);
});

test('sem ocorrências retorna indicadores e contagens zero, mantendo nulos', () => {
  const result = buildDashboard([], [{...row('001',0,null), percentual_rede_esgoto: null}]);
  assert.equal(result.occurrences.total,0);
  assert.equal(result.items[0].occurrences.total,0);
  assert.equal(result.items[0].populacao,null);
  assert.equal(result.items[0].percentualRedeEsgoto,null);
  assert.equal(result.items[0].occurrencesPer10k,null);
});

process.env.KEYCLOAK_ISSUER = 'https://keycloak.invalid/realms/test';
process.env.KEYCLOAK_AUDIENCE = 'test';
require('../dist/config/verifyAccessToken').verifyAccessToken = async token => {
  if (token === 'invalid') throw new Error('invalid');
  return { subject: 'test', roles: token === 'manager' ? ['gestor'] : token === 'citizen' ? ['cidadao'] : [] };
};
let server, base;
before(async () => {
  const app = express();
  app.use(require('../dist/routes/metricsRoutes').default);
  app.use(require('../dist/middlewares/errorMiddleware').errorMiddleware);
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => new Promise(resolve => server.close(resolve)));
const request = (token, path = '/metrics/dashboard') => fetch(base+path, {headers: token ? {authorization:`Bearer ${token}`} : {}});

test('dashboard exige autenticação e aceita cidadãos e gestores; KPIs continuam restritos', async () => {
  repository.findDashboardOccurrences = async () => [occurrence(0.5,0.5)];
  repository.findDashboardNeighborhoods = async () => [row('001',0)];
  assert.equal((await request()).status,401);
  assert.equal((await request('invalid')).status,401);
  assert.equal((await request('no-role')).status,403);
  assert.equal((await request('citizen','/metrics')).status,403);
  for (const role of ['citizen','manager']) {
    const response = await request(role);
    assert.equal(response.status,200);
    assert.equal(response.headers.get('cache-control'),'no-store');
    assert.equal((await response.json()).matchedOccurrences,1);
  }
});

test('ausência de geometria ou falha das fontes retorna indisponibilidade segura', async () => {
  repository.findDashboardOccurrences = async () => [];
  repository.findDashboardNeighborhoods = async () => [{...row('001',0), geometria: null}];
  await assert.rejects(getDashboard(), error => error.status === 503);
  repository.findDashboardNeighborhoods = async () => { throw new Error('postgresql://senha'); };
  const response = await request('citizen');
  assert.equal(response.status,503);
  assert.doesNotMatch(JSON.stringify(await response.json()), /senha|postgresql/);
});
