/**
 * Configure @donatello_splinterson_bot — content Splinter with the same Cursor settings.
 *
 * Prereqs in .env / .dev.vars:
 * - DONATELLO_BOT_TOKEN (or TELEGRAM_BOT_TOKEN)
 * - TELEGRAM_WEBHOOK_SECRET (unique per bot)
 * - CURSOR_API_KEY
 * - WEBHOOK_BASE_URL (deployed donatello Worker URL)
 *
 * Usage: npm run setup:donatello
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
  const vars = loadDevVars();
  const value = process.env[key] ?? vars[key];
  if (!value) throw new Error(`Missing ${key}`);
  return value;
}

function optionalEnv(key: string): string | undefined {
  const vars = loadDevVars();
  return process.env[key] ?? vars[key];
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

const PUBLIC_COMMANDS = [
  { command: 'help', description: 'Show how to summon Donatello' },
  { command: 'chatid', description: 'Show this chat ID' },
  { command: 'myid', description: 'Show your Telegram user ID' },
];

const KEEPER_COMMANDS = [
  { command: 'master_splinter', description: 'Summon Donatello_Splinterson for content work' },
];

async function main(): Promise<void> {
  const token = optionalEnv('DONATELLO_BOT_TOKEN') ?? env('TELEGRAM_BOT_TOKEN');
  const secret = optionalEnv('DONATELLO_WEBHOOK_SECRET') ?? env('TELEGRAM_WEBHOOK_SECRET');

  const me = await api<{ id: number; username: string; first_name: string }>(token, 'getMe');
  console.log(`Bot: @${me.username} (${me.first_name}), id ${me.id}`);

  await api(token, 'setMyCommands', { commands: PUBLIC_COMMANDS });
  console.log('Public commands:', PUBLIC_COMMANDS.map((c) => `/${c.command}`).join(', '));

  const keeperId = optionalEnv('TELEGRAM_DOJO_KEEPER_ID');
  const adminIds = (optionalEnv('TELEGRAM_ADMIN_USER_IDS') ?? keeperId ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  for (const adminId of adminIds) {
    const userId = Number(adminId);
    if (!Number.isFinite(userId)) continue;
    await api(token, 'setMyCommands', {
      commands: [...PUBLIC_COMMANDS, ...KEEPER_COMMANDS],
      scope: { type: 'chat_member', chat_id: userId, user_id: userId },
    });
    console.log(`Keeper commands for user ${userId}: /master_splinter`);
  }

  const webhookUrl = (() => {
    const explicit = optionalEnv('DONATELLO_WEBHOOK_URL') ?? optionalEnv('WEBHOOK_URL');
    const base = optionalEnv('DONATELLO_WEBHOOK_BASE_URL') ?? optionalEnv('WEBHOOK_BASE_URL');
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
    console.log('Webhook skipped: set DONATELLO_WEBHOOK_BASE_URL or WEBHOOK_BASE_URL, then re-run.');
  }

  const info = await api<{
    url: string;
    pending_update_count: number;
    last_error_message?: string;
  }>(token, 'getWebhookInfo');
  console.log('Webhook info:', JSON.stringify(info, null, 2));
  console.log('');
  console.log('Next: in your content channel, as keeper run /master-splinter allow-qa');
  console.log('Then: /master-splinter add-member <user_id> for each teammate');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
