/**
 * Copy CLOUDFLARE_* from local .env / .dev.vars into GitHub Actions secrets.
 * Run on your machine (repo admin): npm run sync:github-secret
 */
import { spawnSync } from 'node:child_process';
import { loadEnvFiles, requireEnv } from './load-env-file';

loadEnvFiles();

const token = requireEnv('CLOUDFLARE_API_TOKEN');
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ?? '53d52ffd40feb5356ce596aadef30109';
const repo = process.env.GITHUB_REPOSITORY?.trim() ?? 'Fyuturevizion/TG-Trello-Agent';

function gh(args: string[]): number {
  const result = spawnSync('gh', args, { stdio: 'inherit', encoding: 'utf8' });
  return result.status ?? 1;
}

const tokenStatus = gh(['secret', 'set', 'CLOUDFLARE_API_TOKEN', '-R', repo, '--body', token]);
if (tokenStatus !== 0) process.exit(tokenStatus);

const accountStatus = gh([
  'secret',
  'set',
  'CLOUDFLARE_ACCOUNT_ID',
  '-R',
  repo,
  '--body',
  accountId,
]);
process.exit(accountStatus);
