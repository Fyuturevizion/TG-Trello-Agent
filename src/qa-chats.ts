import { loadExtraQaChatIds } from './qa-chats-kv';
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

/** Growth Hub Dojo forum supergroup (TELEGRAM_DOJO_CHAT_ID). */
export function parseDojoChatIds(env: Pick<Env, 'TELEGRAM_DOJO_CHAT_ID'>): number[] {
  const raw = env.TELEGRAM_DOJO_CHAT_ID?.trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isFinite(id));
}

export function parseAllowedChatIds(
  env: Pick<Env, 'TELEGRAM_QA_CHAT_ID' | 'TELEGRAM_DOJO_CHAT_ID'>,
): number[] {
  return [...parseQaChatIds(env), ...parseDojoChatIds(env)];
}

export function isQaChatInList(chatIds: number[], chatId: number): boolean {
  return chatIds.includes(chatId);
}

export function isQaChat(env: Env, chatId: number): boolean {
  const ids = parseQaChatIds(env);
  if (ids.length > 0) return ids.includes(chatId);
  return false;
}

/** Env QA IDs plus KV-registered chats (deduped, env order first). */
export async function listQaChatIds(env: Env): Promise<number[]> {
  const fromEnv = parseQaChatIds(env);
  const fromKv = await loadExtraQaChatIds(env);
  const seen = new Set<number>();
  const merged: number[] = [];
  for (const id of [...fromEnv, ...fromKv]) {
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(id);
  }
  return merged;
}

export async function isQaChatAsync(env: Env, chatId: number): Promise<boolean> {
  const ids = await listQaChatIds(env);
  return ids.length > 0 && ids.includes(chatId);
}

export function isDojoChat(env: Env, chatId: number): boolean {
  const ids = parseDojoChatIds(env);
  return ids.includes(chatId);
}

export function primaryQaChatId(env: Env): number | null {
  const ids = parseQaChatIds(env);
  return ids[0] ?? null;
}
