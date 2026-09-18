import type { Env } from './types';

const TTL_SECONDS = 14 * 24 * 60 * 60;
const MAX_IDS = 4000;

function logKey(chatId: number, messageThreadId?: number): string {
  return `botmsg:${chatId}:${messageThreadId ?? 0}`;
}

export async function recordBotMessageId(
  env: Env,
  chatId: number,
  messageId: number,
  messageThreadId?: number,
): Promise<void> {
  const key = logKey(chatId, messageThreadId);
  const raw = await env.SESSIONS.get(key);
  let ids: number[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        ids = parsed.filter((id): id is number => typeof id === 'number' && Number.isFinite(id));
      }
    } catch {
      ids = [];
    }
  }
  ids.push(messageId);
  if (ids.length > MAX_IDS) ids = ids.slice(-MAX_IDS);
  await env.SESSIONS.put(key, JSON.stringify(ids), { expirationTtl: TTL_SECONDS });
}

export async function loadBotMessageIds(
  env: Env,
  chatId: number,
  messageThreadId?: number,
): Promise<number[]> {
  const raw = await env.SESSIONS.get(logKey(chatId, messageThreadId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is number => typeof id === 'number' && Number.isFinite(id));
  } catch {
    return [];
  }
}

export async function clearBotMessageLog(
  env: Env,
  chatId: number,
  messageThreadId?: number,
): Promise<void> {
  await env.SESSIONS.delete(logKey(chatId, messageThreadId));
}
