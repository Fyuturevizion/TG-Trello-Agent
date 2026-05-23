import type { Env } from './types';

const KV_PREFIX = 'card:';
const TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

export interface CardReporter {
  reporterId: number;
  reporterUsername?: string;
  reporterFirstName?: string;
  title: string;
  cardName: string;
}

function kvKey(cardId: string): string {
  return `${KV_PREFIX}${cardId}`;
}

export async function saveCardReporter(
  env: Env,
  cardId: string,
  reporter: CardReporter,
): Promise<void> {
  await env.SESSIONS.put(kvKey(cardId), JSON.stringify(reporter), {
    expirationTtl: TTL_SECONDS,
  });
}

export async function getCardReporter(env: Env, cardId: string): Promise<CardReporter | null> {
  const raw = await env.SESSIONS.get(kvKey(cardId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CardReporter;
  } catch {
    return null;
  }
}
