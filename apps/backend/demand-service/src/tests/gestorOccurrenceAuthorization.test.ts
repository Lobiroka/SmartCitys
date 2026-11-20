import { randomUUID } from 'node:crypto';
import { NivelPrioridade, StatusDenuncia, PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import app from '../app';
import { createTestToken } from './helpers/authToken';

const prisma = new PrismaClient();

const citizenSubject = randomUUID();
const managerSubject = randomUUID();
const citizenToken = createTestToken(citizenSubject, ['cidadao']);
const managerToken = createTestToken(managerSubject, ['gestor']);
const occurrenceIds: number[] = [];

const managementRoutes = [
  {
    name: 'status',
    path: (id: string | number) => `/demandas/gestor/${id}/status`,
    body: { status: 'EM_ANALISE' },
    invalidBody: { status: 'STATUS_INVALIDO' },
  },
  {
    name: 'prioridade',
    path: (id: string | number) => `/demandas/gestor/${id}/prioridade`,
    body: { prioridade: 'ALTA' },
    invalidBody: { prioridade: 'PRIORIDADE_INVALIDA' },
  },
] as const;

let occurrenceId: number;

beforeAll(async () => {
  const citizen = await prisma.cidadao.create({
    data: { keycloak_sub: citizenSubject },
  });

  await prisma.gestor.create({
    data: { keycloak_sub: managerSubject },
  });

  const occurrence = await prisma.denuncia.create({
    data: {
      titulo: 'Ocorrência de teste de autorização',
      categoria: 'SANEAMENTO',
      regiao: 'OUTRA',
      descricao: 'Registro isolado da suíte de autorização.',
      endereco: 'Endereço de teste',
      cidadao_id: citizen.id_cidadao,
    },
  });

  occurrenceId = occurrence.id_denuncia;
  occurrenceIds.push(occurrenceId);
});

afterAll(async () => {
  if (occurrenceIds.length > 0) {
    await prisma.historico.deleteMany({
      where: { denuncia_id: { in: occurrenceIds } },
    });
    await prisma.imagem.deleteMany({
      where: { denuncia_id: { in: occurrenceIds } },
    });
    await prisma.denuncia.deleteMany({
      where: { id_denuncia: { in: occurrenceIds } },
    });
  }

  await prisma.cidadao.deleteMany({
    where: { keycloak_sub: citizenSubject },
  });
  await prisma.gestor.deleteMany({
    where: { keycloak_sub: managerSubject },
  });
  await prisma.$disconnect();
});

describe('Autorização das rotas de gestão de ocorrências', () => {
  it.each(managementRoutes)(
    'retorna 401 sem token ao alterar $name',
    async ({ path, body }) => {
      const response = await request(app)
        .patch(path(occurrenceId))
        .send(body);

      expect(response.status).toBe(401);
    },
  );

  it.each(managementRoutes)(
    'retorna 403 para cidadão ao alterar $name',
    async ({ path, body }) => {
      const response = await request(app)
        .patch(path(occurrenceId))
        .set('Authorization', `Bearer ${citizenToken}`)
        .send(body);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Acesso negado para este perfil');
    },
  );

  it('permite ao gestor alterar status e confirma resposta, persistência e histórico', async () => {
    const response = await request(app)
      .patch(`/demandas/gestor/${occurrenceId}/status`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: 'EM_ANALISE' });

    expect(response.status).toBe(200);
    expect(response.body.denuncia).toMatchObject({
      id_denuncia: occurrenceId,
      status: StatusDenuncia.EM_ANALISE,
    });
    expect(response.body.historico).toMatchObject({
      denuncia_id: occurrenceId,
      status: StatusDenuncia.EM_ANALISE,
    });

    const persistedOccurrence = await prisma.denuncia.findUniqueOrThrow({
      where: { id_denuncia: occurrenceId },
    });
    expect(persistedOccurrence.status).toBe(StatusDenuncia.EM_ANALISE);
  });

  it('permite ao gestor alterar prioridade e confirma resposta, persistência e histórico', async () => {
    const response = await request(app)
      .patch(`/demandas/gestor/${occurrenceId}/prioridade`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ prioridade: 'ALTA' });

    expect(response.status).toBe(200);
    expect(response.body.denuncia).toMatchObject({
      id_denuncia: occurrenceId,
      prioridade: NivelPrioridade.ALTA,
    });
    expect(response.body.historico).toMatchObject({
      denuncia_id: occurrenceId,
      prioridade: NivelPrioridade.ALTA,
    });

    const persistedOccurrence = await prisma.denuncia.findUniqueOrThrow({
      where: { id_denuncia: occurrenceId },
    });
    expect(persistedOccurrence.prioridade).toBe(NivelPrioridade.ALTA);
  });

  it.each(managementRoutes)(
    'retorna 400 para $name inválido',
    async ({ path, invalidBody }) => {
      const response = await request(app)
        .patch(path(occurrenceId))
        .set('Authorization', `Bearer ${managerToken}`)
        .send(invalidBody);

      expect(response.status).toBe(400);
    },
  );

  it.each(managementRoutes)(
    'retorna 400 para ID não numérico na rota de $name',
    async ({ path, body }) => {
      const response = await request(app)
        .patch(path('id-invalido'))
        .set('Authorization', `Bearer ${managerToken}`)
        .send(body);

      expect(response.status).toBe(400);
    },
  );

  it.each(managementRoutes)(
    'retorna 404 para ID numérico inexistente na rota de $name',
    async ({ path, body }) => {
      const response = await request(app)
        .patch(path(2147483647))
        .set('Authorization', `Bearer ${managerToken}`)
        .send(body);

      expect(response.status).toBe(404);
    },
  );
});
