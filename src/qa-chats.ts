import type { Env } from './types';

const EXTRA_QA_CHATS_KEY = 'dojo:extra_qa_chat_ids';
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

async function loadExtraQaChatIds(env: Env): Promise<number[]> {
  const raw = await env.SESSIONS.get(EXTRA_QA_CHATS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((id) => Number(id)).filter((id) => Number.isFinite(id));
  } catch {
    return [];
  }
}

async function saveExtraQaChatIds(env: Env, ids: number[]): Promise<void> {
  const unique = [...new Set(ids)];
  await env.SESSIONS.put(EXTRA_QA_CHATS_KEY, JSON.stringify(unique), {
    expirationTtl: EXTRA_QA_TTL_SECONDS,
  });
}

/** Env-configured IDs plus keeper-added channels stored in KV. */
export async function loadQaChatIds(env: Env): Promise<number[]> {
  const envIds = parseQaChatIds(env);
  const extraIds = await loadExtraQaChatIds(env);
  return [...new Set([...envIds, ...extraIds])];
}

export async function addQaChatId(
  env: Env,
  chatId: number,
): Promise<{ added: boolean; allIds: number[] }> {
  const envIds = parseQaChatIds(env);
  const extraIds = await loadExtraQaChatIds(env);
  const allIds = [...new Set([...envIds, ...extraIds])];
  if (allIds.includes(chatId)) {
    return { added: false, allIds };
  }

  extraIds.push(chatId);
  await saveExtraQaChatIds(env, extraIds);
  return { added: true, allIds: [...new Set([...envIds, ...extraIds])] };
}

export function isQaChat(env: Env, chatId: number): boolean {
  const ids = parseQaChatIds(env);
  if (ids.length > 0) return ids.includes(chatId);
  return false;
}

export async function isQaChatAsync(env: Env, chatId: number): Promise<boolean> {
  const ids = await loadQaChatIds(env);
  if (ids.length > 0) return ids.includes(chatId);
  return false;
}

export function primaryQaChatId(env: Env): number | null {
  const ids = parseQaChatIds(env);
  return ids[0] ?? null;
}

export async function primaryQaChatIdAsync(env: Env): Promise<number | null> {
  const ids = await loadQaChatIds(env);
  return ids[0] ?? null;
}
