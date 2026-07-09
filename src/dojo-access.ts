import { sendMessage } from './telegram';
import type { Env, TelegramMessage } from './types';

const GRANTED_SPLINTER_KEY = 'dojo:granted_splinter';
const LEGACY_GRANTED_ADMINS_KEY = 'dojo:granted_admins';
const GRANTED_TTL_SECONDS = 365 * 24 * 60 * 60;

/** Hidden command — not registered in BotFather menu. */
export const DOJO_GRANT_CMD = '/dojo_grant';

/**
 * Secret phrase to promote a summoner (set as Worker secret DOJO_ADMIN_SECRET).
 * Keeper-only; never commit the live value — use this when running wrangler secret put.
 */
export const DOJO_ADMIN_SECRET_PLACEHOLDER = 'ratking-pizza-decree';

function parseUserIdList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw.split(',').map((id) => id.trim()).filter(Boolean);
}

function parseUsernameList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((name) => name.trim().replace(/^@/, '').toLowerCase())
    .filter(Boolean);
}

/** The one keeper who may grant summoners with the secret word or add-member. */
export function isDojoKeeper(env: Env, userId: number): boolean {
  const keeper = env.TELEGRAM_DOJO_KEEPER_ID?.trim();
  if (!keeper) return false;
  return String(userId) === keeper;
}

async function loadGrantedSplinterIds(env: Env): Promise<string[]> {
  const keys = [GRANTED_SPLINTER_KEY, LEGACY_GRANTED_ADMINS_KEY];
  const merged: string[] = [];
  for (const key of keys) {
    const raw = await env.SESSIONS.get(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) continue;
      for (const id of parsed) {
        const s = String(id).trim();
        if (s) merged.push(s);
      }
    } catch {
      const legacy = Number.parseInt(raw, 10);
      if (Number.isFinite(legacy)) merged.push(String(legacy));
    }
  }
  return [...new Set(merged)];
}

async function saveGrantedSplinterIds(env: Env, ids: string[]): Promise<void> {
  const unique = [...new Set(ids)];
  await env.SESSIONS.put(GRANTED_SPLINTER_KEY, JSON.stringify(unique), {
    expirationTtl: GRANTED_TTL_SECONDS,
  });
}

/**
 * May author repo changes via /master-splinter (numeric IDs only, no username fallback).
 * Keeper + TELEGRAM_CODE_ADMIN_USER_IDS + legacy TELEGRAM_ADMIN_USER_IDS.
 */
export function isCodeAdmin(env: Env, userId: number): boolean {
  if (isDojoKeeper(env, userId)) return true;

  const codeIds = parseUserIdList(env.TELEGRAM_CODE_ADMIN_USER_IDS);
  if (codeIds.includes(String(userId))) return true;

  const legacyAdminIds = parseUserIdList(env.TELEGRAM_ADMIN_USER_IDS);
  return legacyAdminIds.includes(String(userId));
}

/** May speak with Splinter (questions). Code changes require isCodeAdmin. */
export async function canSummonSplinter(
  env: Env,
  userId: number,
  username?: string,
): Promise<boolean> {
  if (isCodeAdmin(env, userId)) return true;

  const splinterIds = parseUserIdList(env.TELEGRAM_SPLINTER_USER_IDS);
  if (splinterIds.includes(String(userId))) return true;

  const splinterNames = parseUsernameList(env.TELEGRAM_SPLINTER_USERNAMES);
  if (username && splinterNames.includes(username.toLowerCase())) return true;

  const legacyNames = parseUsernameList(env.TELEGRAM_ADMIN_USERNAMES);
  if (username && legacyNames.includes(username.toLowerCase())) return true;

  const granted = await loadGrantedSplinterIds(env);
  return granted.includes(String(userId));
}

/** Setup, /product start, and repo edits — code keeper only (numeric ID). */
export async function isAdminUser(env: Env, userId: number): Promise<boolean> {
  return isCodeAdmin(env, userId);
}

function secretMatches(env: Env, provided: string): boolean {
  const expected = env.DOJO_ADMIN_SECRET?.trim();
  if (!expected || !provided.trim()) return false;
  return provided.trim() === expected;
}

function normalizeTargetUserId(raw: string): string | null {
  const targetId = raw.replace(/\D/g, '');
  if (!targetId || !/^-?\d+$/.test(targetId)) return null;
  return targetId;
}

/** Keeper-only: grant Splinter summon without the secret phrase. */
export async function grantSplinterMember(
  env: Env,
  chatId: number,
  targetRaw: string,
): Promise<void> {
  const targetId = normalizeTargetUserId(targetRaw);
  if (!targetId) {
    await sendMessage(env, chatId, 'Provide a numeric Telegram user ID (use /myid in that account).');
    return;
  }

  if (isCodeAdmin(env, Number(targetId))) {
    await sendMessage(env, chatId, 'That user is already the code keeper or a code admin.');
    return;
  }

  const granted = await loadGrantedSplinterIds(env);
  if (granted.includes(targetId)) {
    await sendMessage(env, chatId, `User <code>${targetId}</code> may already summon me.`, {
      parseMode: 'HTML',
    });
    return;
  }

  granted.push(targetId);
  await saveGrantedSplinterIds(env, granted);

  await sendMessage(
    env,
    chatId,
    [
      `Added <code>${targetId}</code> to this channel's summon list.`,
      'They may use <code>/master_splinter</code> for questions here.',
      'Only the keeper may request repo changes.',
    ].join('\n'),
    { parseMode: 'HTML' },
  );
}

/**
 * /dojo_grant &lt;secret&gt; &lt;telegram_user_id&gt;
 * Keeper-only: grants Splinter summon (questions). Not code admin.
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
      'Summon grant is locked. Set DOJO_ADMIN_SECRET on the Worker first.',
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

  await grantSplinterMember(env, chatId, targetRaw);
}
