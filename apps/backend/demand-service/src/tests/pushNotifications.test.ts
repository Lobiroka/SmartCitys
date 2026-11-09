import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import app from '../app';
import { prisma } from '../lib/prisma';
import { sendOccurrenceStatusNotification } from '../services/pushNotificationService';
import { createTestToken } from './helpers/authToken';

const owner = randomUUID();
const other = randomUUID();
const ownerDevice = 'ExpoPushToken[' + owner + ']';
const otherDevice = 'ExpoPushToken[' + other + ']';
const ownerAuth = 'Bearer ' + createTestToken(owner, ['cidadao']);
const otherAuth = 'Bearer ' + createTestToken(other, ['gestor']);
const path = '/demandas/devices/push';

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await prisma.pushDevice.deleteMany({ where: { token: { in: [ownerDevice, otherDevice] } } });
  await prisma.cidadao.deleteMany({ where: { keycloak_sub: owner } });
});

describe('Notificações de status', () => {
  it('registra o aparelho do usuário autenticado e impede outro usuário de removê-lo', async () => {
    expect((await request(app).put(path).send({ token: ownerDevice })).status).toBe(401);
    expect((await request(app).put(path).set('Authorization', ownerAuth).send({ token: 'inválido' })).status)
      .toBe(400);
    expect((await request(app).put(path).set('Authorization', ownerAuth).send({ token: ownerDevice })).status)
      .toBe(204);

    expect((await request(app).delete(path).set('Authorization', otherAuth).send({ token: ownerDevice })).status)
      .toBe(204);
    expect(await prisma.pushDevice.findUnique({ where: { token: ownerDevice } })).toMatchObject({ keycloakSub: owner });

    expect((await request(app).delete(path).set('Authorization', ownerAuth).send({ token: ownerDevice })).status)
      .toBe(204);
    expect(await prisma.pushDevice.findUnique({ where: { token: ownerDevice } })).toBeNull();
  });

  it('envia somente aos aparelhos do dono e remove token marcado como inativo', async () => {
    vi.stubEnv('EXPO_PUSH_ACCESS_TOKEN', 'test-token');
    await prisma.pushDevice.createMany({ data: [
      { token: ownerDevice, keycloakSub: owner },
      { token: otherDevice, keycloakSub: other },
    ] });
    const citizen = await prisma.cidadao.create({ data: { keycloak_sub: owner } });
    const send = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }],
    })));
    vi.stubGlobal('fetch', send);

    await sendOccurrenceStatusNotification(citizen.id_cidadao);

    expect(send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(send.mock.calls[0][1].body)).toMatchObject([{ to: ownerDevice }]);
    expect(await prisma.pushDevice.findUnique({ where: { token: ownerDevice } })).toBeNull();
    expect(await prisma.pushDevice.findUnique({ where: { token: otherDevice } })).toBeTruthy();
  });
});
