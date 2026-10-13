// Reutilização exclusiva para depurar o Maestro sem recompilar o mesmo aplicativo.
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const yaml = require('js-yaml');

async function main() {
  const runId = process.env.APK_RUN_ID;
  if (!/^\d+$/.test(runId ?? '')) throw new Error('ID de execução inválido.');
  const response = await fetch(
    `${process.env.GITHUB_API_URL}/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${runId}`,
    { headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, 'X-GitHub-Api-Version': '2022-11-28' } },
  );
  if (!response.ok) throw new Error(`Não foi possível consultar a execução: HTTP ${response.status}`);
  const run = await response.json();
  if (run.head_branch !== process.env.GITHUB_REF_NAME || !/^[a-f0-9]{40}$/.test(run.head_sha)) {
    throw new Error('O APK precisa ter sido gerado nesta mesma branch.');
  }
  execFileSync('git', ['fetch', '--depth=1', 'origin', run.head_sha], { stdio: 'inherit' });
  execFileSync('git', ['diff', '--quiet', run.head_sha, 'HEAD', '--',
    'apps/mobile', 'packages', 'package-lock.json', '.github/scripts/configure-test-android.py']);
  const workflowPath = '.github/workflows/testes-api.yml';
  const previous = yaml.load(execFileSync('git', ['show', `${run.head_sha}:${workflowPath}`], { encoding: 'utf8' }));
  const current = yaml.load(fs.readFileSync(workflowPath, 'utf8'));
  const build = (workflow) => workflow.jobs['regressao-completa'].steps.find(
    (step) => step.name === 'Gerar APK Android para testes',
  );
  if (JSON.stringify(build(previous).env) !== JSON.stringify(build(current).env)
      || build(previous).run !== build(current).run) {
    throw new Error('A configuração do build mudou; execute sem reusar o APK.');
  }
  console.log('APK da mesma branch, código e configuração de build conferidos.');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
