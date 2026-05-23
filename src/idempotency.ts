import type { Env } from './types';

const UPDATE_PREFIX = 'update:';
const TTL_SECONDS = 86400;

export async function isDuplicateUpdate(env: Env, updateId: number): Promise<boolean> {
  const key = `${UPDATE_PREFIX}${updateId}`;
  const existing = await env.SESSIONS.get(key);
  if (existing) return true;
  await env.SESSIONS.put(key, '1', { expirationTtl: TTL_SECONDS });
  return false;
}
