import { sendMessage } from './telegram';
import type { Env } from './types';

const GRANTED_REPORTERS_KEY = 'dojo:granted_reporters';
const GRANTED_TTL_SECONDS = 365 * 24 * 60 * 60;

function parseUserIdList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw.split(',').map((id) => id.trim()).filter(Boolean);
}

export async function loadGrantedReporterIds(env: Env): Promise<string[]> {
  const raw = await env.SESSIONS.get(GRANTED_REPORTERS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((id) => String(id).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

async function saveGrantedReporterIds(env: Env, ids: string[]): Promise<void> {
  const unique = [...new Set(ids)];
  await env.SESSIONS.put(GRANTED_REPORTERS_KEY, JSON.stringify(unique), {
    expirationTtl: GRANTED_TTL_SECONDS,
  });
}

function normalizeTargetUserId(raw: string): string | null {
  const targetId = raw.replace(/\D/g, '');
  if (!targetId || !/^-?\d+$/.test(targetId)) return null;
  return targetId;
}

/** Env allowlist plus keeper-granted reporter IDs in KV. Empty both means any QA member may report. */
export async function isReporterAllowed(env: Env, userId: number): Promise<boolean> {
  const staticIds = parseUserIdList(env.TELEGRAM_ALLOWED_USER_IDS);
  const granted = await loadGrantedReporterIds(env);
  if (staticIds.length === 0 && granted.length === 0) return true;
  const id = String(userId);
  return staticIds.includes(id) || granted.includes(id);
}

export async function grantReporter(
  env: Env,
  chatId: number,
  targetRaw: string,
): Promise<void> {
  const targetId = normalizeTargetUserId(targetRaw);
  if (!targetId) {
    await sendMessage(env, chatId, 'Provide a numeric Telegram user ID (use /myid in that account).');
    return;
  }

  const staticIds = parseUserIdList(env.TELEGRAM_ALLOWED_USER_IDS);
  if (staticIds.includes(targetId)) {
    await sendMessage(env, chatId, `User <code>${targetId}</code> is already on the reporter allowlist.`, {
      parseMode: 'HTML',
    });
    return;
  }

  const granted = await loadGrantedReporterIds(env);
  if (granted.includes(targetId)) {
    await sendMessage(env, chatId, `User <code>${targetId}</code> may already file bugs.`, {
      parseMode: 'HTML',
    });
    return;
  }

  granted.push(targetId);
  await saveGrantedReporterIds(env, granted);

  await sendMessage(
    env,
    chatId,
    [
      `Reporter access granted to <code>${targetId}</code>.`,
      'They may use /report, /bug, and the Mini App once they are in this QA channel.',
      'They still need to tap Start in a private chat with the bot if the form will not open.',
    ].join('\n'),
    { parseMode: 'HTML' },
  );
}

/** Comma- or space-separated Telegram user IDs. */
export async function grantReportersFromList(
  env: Env,
  chatId: number,
  rawList: string,
): Promise<void> {
  const parts = rawList
    .split(/[\s,]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    await sendMessage(
      env,
      chatId,
      'Usage: /master-splinter add-reporter &lt;telegram_user_id&gt; (comma-separated for several)',
      { parseMode: 'HTML' },
    );
    return;
  }
  for (const part of parts) {
    await grantReporter(env, chatId, part);
  }
}
