import type { Env } from './types';

/** Comma-separated supergroup/channel IDs in TELEGRAM_QA_CHAT_ID. */
export function parseQaChatIds(env: Pick<Env, 'TELEGRAM_QA_CHAT_ID'>): number[] {
  const raw = env.TELEGRAM_QA_CHAT_ID?.trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isFinite(id));
}

export function isQaChat(env: Env, chatId: number): boolean {
  const ids = parseQaChatIds(env);
  if (ids.length > 0) return ids.includes(chatId);
  return false;
}

export function primaryQaChatId(env: Env): number | null {
  const ids = parseQaChatIds(env);
  return ids[0] ?? null;
}
