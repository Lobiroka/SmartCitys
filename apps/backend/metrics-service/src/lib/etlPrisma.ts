import { PrismaClient } from '@prisma/client';

let client: PrismaClient | undefined;

// Não inicializar no bootstrap: a ETL é uma integração opcional.
export function getEtlPrisma(): PrismaClient {
  if (!client) {
    const connection = process.env.DATABASE_URL_ETL?.trim();
    if (!connection) {
      throw new Error('DATABASE_URL_ETL não configurada');
    }

    const url = new URL(connection);
    url.searchParams.set('connection_limit', '2');
    url.searchParams.set('connect_timeout', '5');
    url.searchParams.set('pool_timeout', '5');
    client = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  }
  return client;
}
