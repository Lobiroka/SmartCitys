import 'dotenv/config';

// As suítes gravam e removem dados: use uma conexão exclusiva de testes.
export function setup() {
  const databaseUrl = process.env.TEST_DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'Defina TEST_DATABASE_URL apontando para um banco exclusivo de testes com o schema atualizado.'
    );
  }

  process.env.DATABASE_URL = databaseUrl;
}
