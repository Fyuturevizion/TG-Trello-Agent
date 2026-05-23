import type { Env, Session } from './types';

const SESSION_PREFIX = 'session:';

export function sessionKey(chatId: number, userId: number): string {
  return `${SESSION_PREFIX}${chatId}:${userId}`;
}

function sessionTtl(env: Env): number {
  const parsed = Number(env.SESSION_TTL_SECONDS ?? '3600');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3600;
}

export async function loadSession(
  env: Env,
  chatId: number,
  userId: number,
): Promise<Session | null> {
  const raw = await env.SESSIONS.get(sessionKey(chatId, userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export async function saveSession(
  env: Env,
  chatId: number,
  userId: number,
  session: Session,
): Promise<void> {
  await env.SESSIONS.put(sessionKey(chatId, userId), JSON.stringify(session), {
    expirationTtl: sessionTtl(env),
  });
}

export async function clearSession(
  env: Env,
  chatId: number,
  userId: number,
): Promise<void> {
  await env.SESSIONS.delete(sessionKey(chatId, userId));
}

export function emptySession(state: Session['state'] = 'idle'): Session {
  return { state, photoFileIds: [] };
}
