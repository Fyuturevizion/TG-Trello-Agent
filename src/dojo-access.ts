import { sendMessage } from './telegram';
import type { Env, TelegramMessage } from './types';

const GRANTED_ADMINS_KEY = 'dojo:granted_admins';
const GRANTED_TTL_SECONDS = 365 * 24 * 60 * 60;

/** Hidden command — not registered in BotFather menu. */
export const DOJO_GRANT_CMD = '/dojo_grant';

/**
 * Secret phrase to promote an admin (set as Worker secret DOJO_ADMIN_SECRET).
 * Keeper-only; never commit the live value — use this when running wrangler secret put.
 */
export const DOJO_ADMIN_SECRET_PLACEHOLDER = 'ratking-pizza-decree';

function parseUserIdList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw.split(',').map((id) => id.trim()).filter(Boolean);
}

/** The one keeper who may grant admin with the secret word. */
export function isDojoKeeper(env: Env, userId: number): boolean {
  const keeper = env.TELEGRAM_DOJO_KEEPER_ID?.trim();
  if (!keeper) return false;
  return String(userId) === keeper;
}

async function loadGrantedAdminIds(env: Env): Promise<string[]> {
  const raw = await env.SESSIONS.get(GRANTED_ADMINS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((id) => String(id).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

async function saveGrantedAdminIds(env: Env, ids: string[]): Promise<void> {
  const unique = [...new Set(ids)];
  await env.SESSIONS.put(GRANTED_ADMINS_KEY, JSON.stringify(unique), {
    expirationTtl: GRANTED_TTL_SECONDS,
  });
}

/** Admin = dojo keeper, TELEGRAM_ADMIN_USER_IDS, or keeper-granted IDs only. */
export async function isAdminUser(env: Env, userId: number): Promise<boolean> {
  if (isDojoKeeper(env, userId)) return true;

  const staticAdmins = parseUserIdList(env.TELEGRAM_ADMIN_USER_IDS);
  if (staticAdmins.includes(String(userId))) return true;

  const granted = await loadGrantedAdminIds(env);
  return granted.includes(String(userId));
}

function secretMatches(env: Env, provided: string): boolean {
  const expected = env.DOJO_ADMIN_SECRET?.trim();
  if (!expected || !provided.trim()) return false;
  return provided.trim() === expected;
}

/**
 * /dojo_grant &lt;secret&gt; &lt;telegram_user_id&gt;
 * Only the dojo keeper (TELEGRAM_DOJO_KEEPER_ID) may invoke this.
 */
export async function handleDojoGrantCommand(
  env: Env,
  message: TelegramMessage,
): Promise<void> {
  const userId = message.from?.id;
  const chatId = message.chat.id;
  if (!userId) return;

  if (!isDojoKeeper(env, userId)) {
    return;
  }

  if (!env.DOJO_ADMIN_SECRET?.trim()) {
    await sendMessage(
      env,
      chatId,
      'Admin grant is locked. Set DOJO_ADMIN_SECRET on the Worker first.',
    );
    return;
  }

  const parts = (message.text?.trim() ?? '').split(/\s+/);
  const secret = parts[1] ?? '';
  const targetRaw = parts[2] ?? '';

  if (!secret || !targetRaw) {
    await sendMessage(
      env,
      chatId,
      `Usage (keeper only): <code>${DOJO_GRANT_CMD} &lt;secret&gt; &lt;telegram_user_id&gt;</code>`,
      { parseMode: 'HTML' },
    );
    return;
  }

  if (!secretMatches(env, secret)) {
    await sendMessage(env, chatId, 'The dojo does not recognize that word.');
    return;
  }

  const targetId = targetRaw.replace(/\D/g, '');
  if (!targetId || !/^-?\d+$/.test(targetId)) {
    await sendMessage(env, chatId, 'Provide a numeric Telegram user ID (use /myid in that account).');
    return;
  }

  if (isDojoKeeper(env, Number(targetId))) {
    await sendMessage(env, chatId, 'The keeper is already supreme admin of this dojo.');
    return;
  }

  const staticAdmins = parseUserIdList(env.TELEGRAM_ADMIN_USER_IDS);
  if (staticAdmins.includes(targetId)) {
    await sendMessage(env, chatId, `User <code>${targetId}</code> is already a fixed admin.`, {
      parseMode: 'HTML',
    });
    return;
  }

  const granted = await loadGrantedAdminIds(env);
  if (granted.includes(targetId)) {
    await sendMessage(env, chatId, `User <code>${targetId}</code> already has admin.`, {
      parseMode: 'HTML',
    });
    return;
  }

  granted.push(targetId);
  await saveGrantedAdminIds(env, granted);

  await sendMessage(
    env,
    chatId,
    `Granted admin to <code>${targetId}</code>. They may use <code>/master_splinter</code> and <code>/setup</code>.`,
    { parseMode: 'HTML' },
  );
}
