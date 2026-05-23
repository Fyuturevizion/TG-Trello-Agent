/**
 * Configure @WLTH_Triage_Bot via Telegram Bot API.
 * - setMyCommands
 * - setWebhook (requires WEBHOOK_BASE_URL or WEBHOOK_URL in .dev.vars)
 * - getWebhookInfo
 *
 * Usage: npm run setup-telegram
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDevVars(): Record<string, string> {
  for (const name of ['.dev.vars', '.env']) {
    const path = resolve(process.cwd(), name);
    if (!existsSync(path)) continue;
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
  return {};
}

function env(key: string): string {
  const value = process.env[key] ?? loadDevVars()[key];
  if (!value) throw new Error(`Missing ${key}`);
  return value;
}

function optionalEnv(key: string): string | undefined {
  return process.env[key] ?? loadDevVars()[key];
}

async function api<T>(token: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json()) as { ok: boolean; description?: string; result?: T };
  if (!data.ok) throw new Error(`${method}: ${data.description ?? response.statusText}`);
  return data.result as T;
}

const COMMANDS = [
  { command: 'report', description: 'Open bug or wishlist report form' },
  { command: 'bug', description: 'Shortcut: report a bug' },
  { command: 'wishlist', description: 'Shortcut: submit a wishlist item' },
  { command: 'help', description: 'Show available commands' },
  { command: 'agent', description: 'Admin: Cursor agent to update triage bot' },
];

async function main(): Promise<void> {
  const token = env('TELEGRAM_BOT_TOKEN');
  const secret = env('TELEGRAM_WEBHOOK_SECRET');

  const me = await api<{ username: string; first_name: string }>(token, 'getMe');
  console.log(`Bot: @${me.username} (${me.first_name})`);

  await api(token, 'setMyCommands', { commands: COMMANDS });
  console.log('Commands registered:', COMMANDS.map((c) => `/${c.command}`).join(', '));

  const webhookUrl = (() => {
    const explicit = optionalEnv('WEBHOOK_URL');
    const base = optionalEnv('WEBHOOK_BASE_URL');
    const placeholder =
      !base ||
      base.includes('your-account') ||
      (explicit?.includes('your-account') ?? false);
    if (placeholder) return undefined;
    if (explicit && !explicit.includes('your-account')) return explicit;
    if (base) return `${base.replace(/\/$/, '')}/webhook/${secret}`;
    return undefined;
  })();

  if (webhookUrl) {
    await api(token, 'setWebhook', {
      url: webhookUrl,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: false,
    });
    console.log('Webhook set:', webhookUrl);
  } else {
    console.log('Webhook skipped: set WEBHOOK_BASE_URL to your deployed Worker URL, then re-run.');
  }

  const info = await api<{
    url: string;
    pending_update_count: number;
    last_error_message?: string;
  }>(token, 'getWebhookInfo');
  console.log('Webhook info:', JSON.stringify(info, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
