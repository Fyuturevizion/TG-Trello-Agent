import type { Env } from './types';

/** Telegram forum "General" topic id (messages without a named topic often use 1). */
export const TELEGRAM_GENERAL_TOPIC_ID = 1;

const REPORT_THREAD_KV_KEY = 'qa:report-thread-by-chat';
const KV_TTL_SECONDS = 365 * 24 * 60 * 60;

function parseEnvReportThreads(env: Env): Map<number, number> {
  const raw = env.TELEGRAM_QA_REPORT_THREADS?.trim();
  const map = new Map<number, number>();
  if (!raw) return map;
  for (const part of raw.split(',')) {
    const piece = part.trim();
    if (!piece) continue;
    const [chatRaw, threadRaw] = piece.split(':');
    const chatId = Number(chatRaw?.trim());
    const threadId = Number(threadRaw?.trim());
    if (Number.isFinite(chatId) && Number.isFinite(threadId)) {
      map.set(chatId, threadId);
    }
  }
  return map;
}

async function loadKvReportThreads(env: Env): Promise<Record<string, number>> {
  const raw = await env.SESSIONS.get(REPORT_THREAD_KV_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const n = Number(value);
      if (Number.isFinite(n)) out[key] = n;
    }
    return out;
  } catch {
    return {};
  }
}

/** Forum topic id for triage cards, buttons, and Splinter ops (per supergroup). */
export async function getReportThreadId(env: Env, chatId: number): Promise<number | undefined> {
  const fromEnv = parseEnvReportThreads(env).get(chatId);
  if (fromEnv !== undefined) return fromEnv;
  const kv = await loadKvReportThreads(env);
  const stored = kv[String(chatId)];
  return stored !== undefined ? stored : undefined;
}

export async function setReportThreadId(
  env: Env,
  chatId: number,
  messageThreadId: number,
): Promise<void> {
  const kv = await loadKvReportThreads(env);
  kv[String(chatId)] = messageThreadId;
  await env.SESSIONS.put(REPORT_THREAD_KV_KEY, JSON.stringify(kv), {
    expirationTtl: KV_TTL_SECONDS,
  });
}

/**
 * Route Splinter / triage traffic away from General when a report topic is configured.
 * If the admin is already in a named topic, keep that thread.
 */
export async function resolveOpsThread(
  env: Env,
  chatId: number,
  incomingThreadId?: number,
): Promise<number | undefined> {
  const reportThread = await getReportThreadId(env, chatId);
  if (!reportThread) return incomingThreadId;
  if (!incomingThreadId || incomingThreadId === TELEGRAM_GENERAL_TOPIC_ID) {
    return reportThread;
  }
  return incomingThreadId;
}

export async function qaDeliveryThreadId(
  env: Env,
  chatId: number,
): Promise<number | undefined> {
  return getReportThreadId(env, chatId);
}
