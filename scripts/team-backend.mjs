import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backend = path.join(root, 'apps/backend');
const envPath = path.join(backend, '.env.team.local');
const action = process.argv[2] ?? 'up';
const migrationName = process.argv[3];
const validArgs = action === 'migration'
  ? process.argv.length === 4 && /^[a-z0-9_]+$/.test(migrationName ?? '')
  : process.argv.length <= 3 && ['up', 'down', 'logs', 'migrate', 'test', 'check'].includes(action);
if (!validArgs) {
  throw new Error('Use: npm run team:backend -- up|down|logs|migrate|test|check ou migration nome_em_minusculas');
}
if (!existsSync(envPath)) {
  writeFileSync(envPath, `# Credenciais locais geradas neste computador; não usar em nuvem.\nTEAM_DB_PASSWORD=${randomBytes(24).toString('hex')}\nTEAM_TEST_DB_PASSWORD=${randomBytes(24).toString('hex')}\n`, { mode: 0o600, flag: 'wx' });
}
const base = ['compose', '--project-name', 'smartcitys-team', '--env-file', envPath, '-f', path.join(backend, 'compose.team.yml')];
function compose(args) {
  const child = spawnSync('docker', [...base, ...args], { cwd: backend, stdio: 'inherit' });
  if (child.error) throw new Error('Instale e inicie o Docker Desktop com suporte a containers Linux.');
  if (child.status !== 0) process.exit(child.status ?? 1);
}
if (action === 'up') {
  compose(['build', 'demand-service', 'metrics-service', 'api-gateway']);
  compose(['up', '-d', '--wait', 'postgres', 'redis']);
  compose(['run', '--rm', '--no-deps', 'migrate']);
  compose(['up', '-d', '--wait', '--wait-timeout', '180', '--renew-anon-volumes', 'demand-service', 'metrics-service', 'api-gateway']);
  console.log('API local em http://127.0.0.1:8080/health. Banco local separado da AWS e dos testes.');
} else if (action === 'test') {
  compose(['build', 'demand-service', 'metrics-service']);
  compose(['--profile', 'test', 'up', '-d', '--wait', 'postgres-test', 'redis-test']);
  compose(['--profile', 'test', 'run', '--rm', '--no-deps', 'tests']);
  compose(['--profile', 'test', 'run', '--rm', '--no-deps', 'metrics-tests']);
} else if (action === 'migrate') {
  compose(['build', 'demand-service']);
  compose(['up', '-d', '--wait', 'postgres']);
  compose(['run', '--rm', '--no-deps', 'migrate']);
} else if (action === 'migration') {
  compose(['build', 'demand-service']);
  compose(['up', '-d', '--wait', 'postgres']);
  compose(['run', '--rm', '--no-deps', 'migrate', './node_modules/.bin/prisma', 'migrate', 'dev', '--name', migrationName, '--create-only']);
} else if (action === 'check') {
  compose(['--profile', 'test', 'config', '--quiet']);
} else if (action === 'logs') {
  compose(['logs', '--tail', '100', '-f', 'demand-service', 'metrics-service', 'api-gateway']);
} else {
  // Sem --volumes: desligar não descarta os bancos do desenvolvedor.
  compose(['--profile', 'test', 'down']);
}
