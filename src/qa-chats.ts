import type { Env } from './types';

const EXTRA_QA_CHATS_KEY = 'qa:extra-chat-ids';
const EXTRA_QA_TTL_SECONDS = 365 * 24 * 60 * 60;

/** Comma-separated supergroup/channel IDs in TELEGRAM_QA_CHAT_ID. */
export function parseQaChatIds(env: Pick<Env, 'TELEGRAM_QA_CHAT_ID'>): number[] {
  const raw = env.TELEGRAM_QA_CHAT_ID?.trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isFinite(id));
}

function mergeQaChatIds(envIds: number[], extraIds: number[]): number[] {
  const merged = [...envIds];
  for (const id of extraIds) {
    if (!merged.includes(id)) merged.push(id);
  }
  return merged;
}

export async function loadExtraQaChatIds(env: Env): Promise<number[]> {
  const raw = await env.SESSIONS.get(EXTRA_QA_CHATS_KEY);
  if (!raw) return [];
  try {
    const ids = JSON.parse(raw) as unknown;
    if (!Array.isArray(ids)) return [];
    return ids.filter((id): id is number => typeof id === 'number' && Number.isFinite(id));
  } catch {
    return [];
  }
}

/** Env IDs plus KV-registered extras (deduped, env order first). */
export async function getAllQaChatIds(env: Env): Promise<number[]> {
  return mergeQaChatIds(parseQaChatIds(env), await loadExtraQaChatIds(env));
}

/** Register a chat as QA without redeploying TELEGRAM_QA_CHAT_ID. */
export async function addExtraQaChatId(env: Env, chatId: number): Promise<number[]> {
  const envIds = parseQaChatIds(env);
  const extras = await loadExtraQaChatIds(env);
  if (envIds.includes(chatId) || extras.includes(chatId)) {
    return mergeQaChatIds(envIds, extras);
  }
  const next = [...extras, chatId];
  await env.SESSIONS.put(EXTRA_QA_CHATS_KEY, JSON.stringify(next), {
    expirationTtl: EXTRA_QA_TTL_SECONDS,
  });
  return mergeQaChatIds(envIds, next);
}

export function isQaChat(env: Env, chatId: number): boolean {
  const ids = parseQaChatIds(env);
  if (ids.length > 0) return ids.includes(chatId);
  return false;
}

export async function isQaChatAsync(env: Env, chatId: number): Promise<boolean> {
  const ids = await getAllQaChatIds(env);
  if (ids.length > 0) return ids.includes(chatId);
  return false;
}

export function primaryQaChatId(env: Env): number | null {
  const ids = parseQaChatIds(env);
  return ids[0] ?? null;
}

export async function primaryQaChatIdAsync(env: Env): Promise<number | null> {
  const ids = await getAllQaChatIds(env);
  return ids[0] ?? null;
}
