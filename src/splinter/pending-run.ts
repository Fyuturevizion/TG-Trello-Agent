import type { Env } from '../types';

const PENDING_KEY = 'agent:pending';
const TTL_SECONDS = 24 * 60 * 60;

export interface PendingSplinterRun {
  agentId: string;
  runId: string;
  chatId: number;
  createdAt: string;
  /** Meditation message to delete after the real reply is sent. */
  presenceMessageId?: number;
  /** Streamed result text if Cursor API result lags behind SSE. */
  streamedText?: string;
}

export async function savePendingSplinterRun(
  env: Env,
  pending: PendingSplinterRun,
): Promise<void> {
  await env.SESSIONS.put(PENDING_KEY, JSON.stringify(pending), {
    expirationTtl: TTL_SECONDS,
  });
}

export async function loadPendingSplinterRun(env: Env): Promise<PendingSplinterRun | null> {
  const raw = await env.SESSIONS.get(PENDING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingSplinterRun;
  } catch {
    return null;
  }
}

export async function clearPendingSplinterRun(env: Env): Promise<void> {
  await env.SESSIONS.delete(PENDING_KEY);
}

export async function patchPendingSplinterRun(
  env: Env,
  patch: Partial<PendingSplinterRun>,
): Promise<void> {
  const current = await loadPendingSplinterRun(env);
  if (!current) return;
  await savePendingSplinterRun(env, { ...current, ...patch });
}
