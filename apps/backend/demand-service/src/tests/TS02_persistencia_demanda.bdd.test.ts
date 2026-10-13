// TS02 [BDD] — Persistência de nova demanda urbana
//
// PRÉ-REQUISITOS:
//   • PostgreSQL do demand-service rodando e acessível via TEST_DATABASE_URL (banco exclusivo de testes)
//   • Migrations aplicadas (prisma migrate deploy)
//   • Tokens RSA locais e issuer de teste configurados por setupAuth.ts
//
// AUTENTICAÇÃO:
//   O middleware valida assinatura RSA, issuer, audience e papéis do token.
//   Apenas a busca da chave pública é substituída nos testes.
//
// COMANDO:
//   cd backend/demand-service && npx vitest run src/tests/TS02_persistencia_demanda.bdd.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createTestToken } from './helpers/authToken';
import { PrismaClient } from '@prisma/client';
import app from '../app';

const prisma = new PrismaClient();

let token: string;
let tokenGestor: string;
const subjectCidadao = randomUUID();
const subjectGestor = randomUUID();

const idsParaLimpar: number[] = [];

const demandaValida = {
    titulo: 'Buraco na via',
    descricao: 'Cratera perigosa',
    categoria: 'SANEAMENTO', // O enum válido que você encontrou
    regiao: 'OUTRA', // A região válida que você encontrou
    endereco: 'Rua do Teste Automatizado, 123',
    prioridade:'MEDIA',
    latitude: -8.047562,
    longitude: -34.877002,
};

beforeAll(async () => {
  token = createTestToken(subjectCidadao, ['cidadao']);
  tokenGestor = createTestToken(subjectGestor, ['gestor']);
});

afterAll(async () => {
    // 1. Apaga todas as denúncias vinculadas aos cidadãos de teste antes de remover o cadastro
    await prisma.denuncia.deleteMany({
        where: {
            cidadao: {
                keycloak_sub: { in: [subjectCidadao, subjectGestor] }
            }
        }
    });

    // 2. Agora apaga os registros de cidadãos com segurança
    await prisma.cidadao.deleteMany({
        where: { keycloak_sub: { in: [subjectCidadao, subjectGestor] } },
    });


    await prisma.$disconnect();
});

// ──────────────────────────────────────────────────────────────────────────────

describe('TS02 [BDD] - Persistência de nova demanda urbana', () => {

  describe('Cenário: Cidadão autenticado cria uma demanda válida', () => {

    it(
      'Given um cidadão autenticado com token JWT válido, ' +
        'When envia POST /demandas com todos os campos obrigatórios, ' +
        'Then retorna 201 com os dados persistidos no banco',

      async () => {
        const res = await request(app)
          .post('/demandas')
          .set('Authorization', `Bearer ${token}`)
          .send(demandaValida);

        expect(res.status).toBe(201);
        expect(res.body.id_denuncia).toBeDefined();
        expect(res.body.titulo).toBe(demandaValida.titulo);
        expect(res.body.categoria).toBe(demandaValida.categoria);
        expect(res.body.regiao).toBe(demandaValida.regiao);

        idsParaLimpar.push(res.body.id_denuncia);
      }
    );

    it('And o status padrão é ABERTA', async () => {
      const res = await request(app)
        .post('/demandas')
        .set('Authorization', `Bearer ${token}`)
        .send(demandaValida);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('ABERTA');

      idsParaLimpar.push(res.body.id_denuncia);
    });

    it('And a prioridade padrão é MEDIA quando não informada', async () => {
      const { prioridade, ...semPrioridade } = demandaValida;
      const res = await request(app)
        .post('/demandas')
        .set('Authorization', `Bearer ${token}`)
        .send(semPrioridade);

      expect(res.status).toBe(201);
      expect(res.body.prioridade).toBe('MEDIA');

      idsParaLimpar.push(res.body.id_denuncia);
    });

  });

  // ────────────────────────────────────────────────────────────────────────────

  describe('Cenário: Requisição sem autenticação', () => {

    it(
      'Given um usuário sem token, When envia POST /demandas, Then retorna 401',
      async () => {
        const res = await request(app).post('/demandas').send(demandaValida);
        expect(res.status).toBe(401);
      }
    );

  });

  // ────────────────────────────────────────────────────────────────────────────

  describe('Cenário: Gestor tenta criar demanda', () => {

    it(
      'Given um gestor autenticado, ' +
        'When envia POST /demandas, ' +
        'Then retorna 403 com mensagem "Acesso restrito a cidadãos"',

      async () => {
        const res = await request(app)
          .post('/demandas')
          .set('Authorization', `Bearer ${tokenGestor}`)
          .send(demandaValida);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Acesso negado para este perfil');
      }
    );

  });

  // ────────────────────────────────────────────────────────────────────────────

  describe('Cenário: Campos obrigatórios ausentes', () => {

    it(
      'Given um cidadão autenticado, When envia POST /demandas com body vazio, Then retorna 400',
      async () => {
        const res = await request(app)
          .post('/demandas')
          .set('Authorization', `Bearer ${token}`)
          .send({});

        expect(res.status).toBe(400);
      }
    );

  });

  // ────────────────────────────────────────────────────────────────────────────

  describe('Cenário: Categoria inválida', () => {

    it(
      'Given um cidadão autenticado, When envia POST /demandas com categoria inexistente, Then retorna 400',
      async () => {
        const res = await request(app)
          .post('/demandas')
          .set('Authorization', `Bearer ${token}`)
          .send({ ...demandaValida, categoria: 'CATEGORIA_INEXISTENTE' });

        expect(res.status).toBe(400);
      }
    );

  });

  // ────────────────────────────────────────────────────────────────────────────

  describe('Cenário: Região inválida', () => {

    it(
      'Given um cidadão autenticado, When envia POST /demandas com região inexistente, Then retorna 400',
      async () => {
        const res = await request(app)
          .post('/demandas')
          .set('Authorization', `Bearer ${token}`)
          .send({ ...demandaValida, regiao: 'REGIAO_INEXISTENTE' });

        expect(res.status).toBe(400);
      }
    );

  });

  // ────────────────────────────────────────────────────────────────────────────

  describe('Cenário: Criações simultâneas do mesmo cidadão', () => {

    it(
      'Given um cidadão autenticado, ' +
        'When envia dois POSTs simultâneos via Promise.all, ' +
        'Then ambos retornam 201 e o registro de cidadão não é duplicado',
      async () => {
        const [res1, res2] = await Promise.all([
          request(app)
            .post('/demandas')
            .set('Authorization', `Bearer ${token}`)
            .send({ ...demandaValida, titulo: 'BDD Paralela A' }),
          request(app)
            .post('/demandas')
            .set('Authorization', `Bearer ${token}`)
            .send({ ...demandaValida, titulo: 'BDD Paralela B' }),
        ]);

        expect(res1.status).toBe(201);
        expect(res2.status).toBe(201);

        // O upsert em resolveCidadaoId não pode criar duplicatas — deve haver exatamente 1 registro
        const cidadaos = await prisma.cidadao.findMany({
          where: { keycloak_sub: subjectCidadao },
        });
        expect(cidadaos.length).toBe(1);

        idsParaLimpar.push(res1.body.id_denuncia, res2.body.id_denuncia);
      }
    );

  });

});
