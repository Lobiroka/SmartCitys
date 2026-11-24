const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

// O cenário preserva a ausência de ETL usada no onboarding da equipe.
process.env.KEYCLOAK_ISSUER = 'https://keycloak.invalid/realms/test';
process.env.KEYCLOAK_AUDIENCE = 'test';
delete process.env.DATABASE_URL_ETL;
require('../dist/config/verifyAccessToken').verifyAccessToken = async () => ({
  subject: 'test', roles: ['gestor'],
});
require('../dist/repositories/dashboardRepository').findDashboardOccurrences = async () => [];
const metrics = require('../dist/services/metricsService');
const kpis = { total: 0, byCategory: {}, byRegion: {}, byStatus: {}, updatedAt: 'test' };
metrics.getMetrics = async () => kpis;
metrics.refreshMetricsCache = async () => kpis;
const routes = require('../dist/routes/metricsRoutes').default;
const { errorMiddleware } = require('../dist/middlewares/errorMiddleware');
let server, origin;
before(async () => {
  const app = express();
  app.use(routes);
  app.use(errorMiddleware);
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => new Promise(resolve => server.close(resolve)));
const request = (path, method = 'GET') => fetch(origin + path, {
  method, headers: { authorization: 'Bearer manager' },
});

test('sem DATABASE_URL_ETL, somente integrações novas ficam indisponíveis', async () => {
  for (const path of ['/metrics/dashboard', '/metrics/inundation', '/metrics/indicators/neighborhoods']) {
    const response = await request(path);
    assert.equal(response.status, 503);
    assert.doesNotMatch(JSON.stringify(await response.json()), /DATABASE_URL|postgresql|senha|password/);
  }
  for (const [path, method] of [['/metrics', 'GET'], ['/metrics/refresh', 'POST']]) {
    const response = await request(path, method);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), kpis);
  }
});
