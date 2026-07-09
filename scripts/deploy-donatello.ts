/**
 * Deploy the Donatello content bot Worker.
 * Usage: npm run deploy:donatello
 */
import { spawnSync } from 'node:child_process';
import { loadEnvFiles, requireEnv } from './load-env-file';

loadEnvFiles();
requireEnv('CLOUDFLARE_API_TOKEN');

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
if (accountId) {
  process.env.CLOUDFLARE_ACCOUNT_ID = accountId;
}

const result = spawnSync('npx', ['wrangler', 'deploy', '-c', 'wrangler.donatello.jsonc'], {
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
