import type { Env } from './types';

const KV_KEY = 'qa:extra-chat-ids';

function parseIdList(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((id) => (typeof id === 'number' ? id : Number(id)))
      .filter((id) => Number.isFinite(id));
  } catch {
    return [];
  }
}

/** QA supergroups/channels registered at runtime (merged with TELEGRAM_QA_CHAT_ID). */
export async function loadExtraQaChatIds(env: Env): Promise<number[]> {
  const raw = await env.SESSIONS.get(KV_KEY);
  return parseIdList(raw);
}

async function saveExtraQaChatIds(env: Env, chatIds: number[]): Promise<void> {
  const unique = [...new Set(chatIds)].sort((a, b) => a - b);
  await env.SESSIONS.put(KV_KEY, JSON.stringify(unique));
}

export async function addExtraQaChatId(
  env: Env,
  chatId: number,
): Promise<{ added: boolean; chatIds: number[] }> {
  const existing = await loadExtraQaChatIds(env);
  if (existing.includes(chatId)) {
    return { added: false, chatIds: existing };
  }
  const chatIds = [...existing, chatId];
  await saveExtraQaChatIds(env, chatIds);
  return { added: true, chatIds };
}
