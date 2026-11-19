import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mobile = path.join(root, 'apps/mobile');
const args = process.argv.slice(2);
if (args.some(arg => !['--local-api', '--check'].includes(arg))) {
  throw new Error('Opções aceitas: --local-api e --check.');
}
const envPath = path.join(mobile, '.env.team.local');
if (!existsSync(envPath)) copyFileSync(path.join(mobile, '.env.team.example'), envPath);
const config = parseEnv(readFileSync(envPath, 'utf8'));
for (const name of ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_KEYCLOAK_ISSUER', 'EXPO_PUBLIC_KEYCLOAK_CLIENT_ID']) {
  if (!config[name]) throw new Error(`Defina ${name} em apps/mobile/.env.team.local.`);
}
const env = { ...process.env, ...config, EXPO_NO_DOTENV: '1', SMARTCITYS_PREBUILT_CLIENT: '1' };
// Estas variáveis pertencem à compilação centralizada, não ao Metro dos colegas.
delete env.GOOGLE_MAPS_ANDROID_API_KEY;
delete env.GOOGLE_SERVICES_JSON;
delete env.EAS_BUILD_PROFILE;
delete env.EAS_BUILD;
if (args.includes('--local-api')) env.EXPO_PUBLIC_API_URL = 'http://127.0.0.1:8080';
if (args.includes('--check')) {
  console.log('Configuração pública da equipe carregada; nenhum segredo é necessário para iniciar o Metro.');
  console.log(args.includes('--local-api') ? 'Destino: API local via USB/emulador.' : 'Destino: API compartilhada.');
  process.exit(0);
}

const sdkCandidates = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT,
  path.join(homedir(), 'AppData/Local/Android/Sdk'), path.join(homedir(), 'Android/Sdk'),
  path.join(homedir(), 'Library/Android/sdk')].filter(Boolean);
const executable = process.platform === 'win32' ? 'adb.exe' : 'adb';
const adb = sdkCandidates.map(sdk => path.join(sdk, 'platform-tools', executable)).find(existsSync) ?? 'adb';
const probe = spawnSync(adb, ['devices'], { encoding: 'utf8', env });
if (probe.error || probe.status !== 0) throw new Error('ADB indisponível. Configure o Android SDK e abra um emulador ou conecte o celular por USB.');
const devices = probe.stdout.split(/\r?\n/).map(line => line.match(/^(\S+)\s+device$/)?.[1]).filter(Boolean);
// O Expo abre o primeiro Android disponível; ANDROID_SERIAL não controla essa escolha.
const serial = devices.length === 1 ? devices[0] : undefined;
if (!serial) throw new Error('Mantenha apenas um Android conectado: feche outros emuladores ou desconecte os outros celulares.');
env.ANDROID_SERIAL = serial;
for (const port of args.includes('--local-api') ? [8080, 8081] : [8081]) {
  const reverse = spawnSync(adb, ['-s', serial, 'reverse', `tcp:${port}`, `tcp:${port}`], { stdio: 'inherit', env });
  if (reverse.status !== 0) throw new Error(`Não foi possível encaminhar a porta ${port}.`);
}
const require = createRequire(import.meta.url);
const expoCli = path.join(path.dirname(require.resolve('expo/package.json')), 'bin/cli');
console.log('Use o APK DEVELOPMENT da equipe. O APK preview não carrega o código local.');
const child = spawn(process.execPath, [expoCli, 'start', '--dev-client', '--localhost', '--port', '8081', '--android'], {
  cwd: mobile, env, stdio: 'inherit',
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
