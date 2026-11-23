import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';

import app from '../app';
import { prisma } from '../lib/prisma';
import { createTestToken } from './helpers/authToken';

vi.mock('../config/redis', () => ({
  publishDenunciaStatusEvent: vi.fn().mockResolvedValue(undefined),
}));

const citizen = randomUUID();
const manager = randomUUID();
const citizenAuth = 'Bearer ' + createTestToken(citizen, ['cidadao']);
const managerAuth = 'Bearer ' + createTestToken(manager, ['gestor']);
const device = 'ExpoPushToken[' + citizen + ']';
const photo = 'data:image/jpeg;base64,aW1hZ2VtLWRlLXRlc3Rl';

afterAll(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await prisma.pushDevice.deleteMany({ where: { token: device } });
  await prisma.denuncia.deleteMany({ where: { cidadao: { keycloak_sub: citizen } } });
  await prisma.cidadao.deleteMany({ where: { keycloak_sub: citizen } });
  await prisma.gestor.deleteMany({ where: { keycloak_sub: manager } });
});

describe('Jornada integrada da API para o Android', () => {
  it('persiste foto e GPS, permite gestão e notifica o proprietário', async () => {
    vi.stubEnv('EXPO_PUSH_ACCESS_TOKEN', 'test-token');
    const transport = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ status: 'ok' }],
    })));
    vi.stubGlobal('fetch', transport);

    expect((await request(app).put('/demandas/devices/push')
      .set('Authorization', citizenAuth).send({ token: device })).status).toBe(204);

    const created = await request(app).post('/demandas').set('Authorization', citizenAuth).send({
      titulo: 'Jornada Android ' + citizen.slice(0, 8),
      categoria: 'SANEAMENTO',
      regiao: 'REGIAO_METROPOLITANA_DO_RECIFE',
      descricao: 'Demanda fictícia com foto e localização.',
      latitude: -8.0476,
      longitude: -34.877,
      imagens: [photo],
    });
    expect(created.status).toBe(201);
    const id = created.body.id_denuncia;
    expect(created.body).toMatchObject({ status: 'ABERTA', latitude: -8.0476, longitude: -34.877 });
    expect(created.body.imagens).toEqual([expect.objectContaining({ caminho_file: photo })]);

    const own = await request(app).get('/demandas/my-demands?page=1&limit=100')
      .set('Authorization', citizenAuth);
    expect(own.status).toBe(200);
    expect(own.body.data).toEqual([expect.objectContaining({ id_denuncia: id })]);

    const managed = await request(app).get('/demandas/gestor/' + id)
      .set('Authorization', managerAuth);
    expect(managed.status).toBe(200);
    expect(managed.body.imagens[0].caminho_file).toBe(photo);

    expect((await request(app).patch('/demandas/gestor/' + id + '/status')
      .set('Authorization', citizenAuth).send({ status: 'EM_ANALISE' })).status).toBe(403);
    const changed = await request(app).patch('/demandas/gestor/' + id + '/status')
      .set('Authorization', managerAuth).send({ status: 'EM_ANALISE' });
    expect(changed.status).toBe(200);
    expect(changed.body.historico).toMatchObject({ denuncia_id: id, status: 'EM_ANALISE' });

    expect(transport).toHaveBeenCalledTimes(1);
    expect(JSON.parse(transport.mock.calls[0][1].body)).toEqual([
      expect.objectContaining({ to: device, body: 'Uma das suas ocorrências teve o status atualizado.' }),
    ]);
    const updated = await request(app).get('/demandas/' + id).set('Authorization', citizenAuth);
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ status: 'EM_ANALISE', latitude: -8.0476, longitude: -34.877 });
    expect(updated.body.imagens[0].caminho_file).toBe(photo);
    expect((await request(app).delete('/demandas/' + id).set('Authorization', citizenAuth)).status).toBe(400);
  });
});
