import { prisma } from '../lib/prisma';

const expoPushEndpoint = 'https://exp.host/--/api/v2/push/send';

type PushTicket = {
  status: 'ok' | 'error';
  details?: { error?: string };
};

export async function registerPushToken(token: string, keycloakSub: string) {
  await prisma.pushDevice.upsert({
    where: { token },
    create: { token, keycloakSub },
    update: { keycloakSub },
  });
}

export async function unregisterPushToken(token: string, keycloakSub: string) {
  await prisma.pushDevice.deleteMany({ where: { token, keycloakSub } });
}

export async function sendOccurrenceStatusNotification(cidadaoId: number) {
  const accessToken = process.env.EXPO_PUSH_ACCESS_TOKEN;
  if (!accessToken) return;

  const owner = await prisma.cidadao.findUnique({
    where: { id_cidadao: cidadaoId },
    select: { keycloak_sub: true },
  });
  if (!owner) return;

  const devices = await prisma.pushDevice.findMany({
    where: { keycloakSub: owner.keycloak_sub },
    select: { token: true },
    take: 100,
  });
  if (devices.length === 0) return;

  const response = await fetch(expoPushEndpoint, {
    method: 'POST',
    signal: AbortSignal.timeout(2500),
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(devices.map(({ token }) => ({
      to: token,
      title: 'SmartCitys',
      body: 'Uma das suas ocorrências teve o status atualizado.',
      channelId: 'occurrence-status',
    }))),
  });
  if (!response.ok) {
    throw new Error('O serviço de push retornou HTTP ' + response.status);
  }

  const { data: tickets } = await response.json() as { data: PushTicket[] };
  const inactiveTokens = devices
    .filter((_, index) => tickets[index]?.details?.error === 'DeviceNotRegistered')
    .map(({ token }) => token);
  if (inactiveTokens.length) {
    await prisma.pushDevice.deleteMany({
      where: { keycloakSub: owner.keycloak_sub, token: { in: inactiveTokens } },
    });
  }
}
