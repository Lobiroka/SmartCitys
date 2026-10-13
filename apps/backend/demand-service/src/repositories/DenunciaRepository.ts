import { PrismaClient, Categorias, Regioes, NivelPrioridade } from '@prisma/client';

const prisma = new PrismaClient();

export type CreateDenunciaInput = {
  titulo: string;
  categoria: Categorias;
  regiao: Regioes;
  descricao: string;
  prioridade: NivelPrioridade;
  endereco: string;
  cidadaoId: number;
};

export async function findOrCreateCidadao(subject: string) {
  return prisma.cidadao.upsert({
    where: { keycloak_sub: subject },
    update: {},
    create: { keycloak_sub: subject },
  });
}

export async function createDenuncia(data: CreateDenunciaInput) {
  return prisma.denuncia.create({
    data: {
      titulo: data.titulo,
      categoria: data.categoria,
      regiao: data.regiao,
      descricao: data.descricao,
      prioridade: data.prioridade,
      endereco: data.endereco,
      cidadao_id: data.cidadaoId,
    },
  });
}

export async function deleteDenunciaById(id: number) {
  return prisma.denuncia.delete({ where: { id_denuncia: id } });
}

export async function deleteCidadaoByUsuarioId(subject:string) {
  return prisma.cidadao.delete({
    where: { keycloak_sub: subject },
  });
}