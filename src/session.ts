import type { Env } from './types';

const SESSION_PREFIX = 'session:';

export function sessionKey(chatId: number, userId: number): string {
  return `${SESSION_PREFIX}${chatId}:${userId}`;
}

export async function clearSession(env: Env, chatId: number, userId: number): Promise<void> {
  await env.SESSIONS.delete(sessionKey(chatId, userId));
}
