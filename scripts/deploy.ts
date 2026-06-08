/**
 * Deploy the Worker using credentials from .env / .dev.vars.
 * Usage: npm run deploy
 */
import { spawnSync } from 'node:child_process';
import { loadEnvFiles, requireEnv } from './load-env-file';

loadEnvFiles();
requireEnv('CLOUDFLARE_API_TOKEN');

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
if (accountId) {
  process.env.CLOUDFLARE_ACCOUNT_ID = accountId;
}

const result = spawnSync('npx', ['wrangler', 'deploy'], {
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
