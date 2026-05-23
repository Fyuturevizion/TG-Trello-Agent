/**
 * Register Telegram webhook. Requires .dev.vars or env vars.
 *
 * Usage:
 *   WEBHOOK_BASE_URL=https://wlth-tg-trello-triage.<account>.workers.dev npm run set-webhook
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDevVars(): Record<string, string> {
  const path = resolve(process.cwd(), '.dev.vars');
  if (!existsSync(path)) return {};
  const vars: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return vars;
}

function env(key: string): string {
  const value = process.env[key] ?? loadDevVars()[key];
  if (!value) throw new Error(`Missing ${key}`);
  return value;
}

async function main(): Promise<void> {
  const token = env('TELEGRAM_BOT_TOKEN');
  const secret = env('TELEGRAM_WEBHOOK_SECRET');
  const baseUrl = env('WEBHOOK_BASE_URL').replace(/\/$/, '');
  const webhookUrl = `${baseUrl}/webhook/${secret}`;

  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: false,
    }),
  });

  const data = (await response.json()) as { ok: boolean; description?: string };
  if (!data.ok) {
    throw new Error(data.description ?? 'setWebhook failed');
  }

  console.log('Webhook registered:', webhookUrl);
  console.log('Set WEBHOOK_URL in wrangler secrets/vars to this URL for the cron watchdog.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
