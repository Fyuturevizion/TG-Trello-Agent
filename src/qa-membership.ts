import { getAllQaChatIds, parseDojoChatIds } from './qa-chats';
import type { Env } from './types';

const TELEGRAM_API = 'https://api.telegram.org';

async function getChatMemberStatus(
  env: Env,
  chatId: number,
  userId: number,
): Promise<string | null> {
  const url = `${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/getChatMember`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, user_id: userId }),
  });
  const data = (await response.json()) as {
    ok: boolean;
    result?: { status: string };
  };
  if (!data.ok || !data.result) return null;
  return data.result.status;
}

const MEMBER_CACHE_PREFIX = 'dojo:qa_member:';
const MEMBER_CACHE_TTL_SECONDS = 24 * 60 * 60;

function qaMembersFullAccess(env: Env): boolean {
  return env.TELEGRAM_QA_CHANNEL_MEMBERS_FULL_ACCESS?.trim().toLowerCase() === 'true';
}

const MEMBER_STATUSES = new Set(['creator', 'administrator', 'member', 'restricted']);

async function isMemberOfChat(env: Env, chatId: number, userId: number): Promise<boolean> {
  const status = await getChatMemberStatus(env, chatId, userId);
  if (!status) return false;
  return MEMBER_STATUSES.has(status);
}

/** When TELEGRAM_QA_CHANNEL_MEMBERS_FULL_ACCESS=true, any QA or Dojo chat member gets reporter + Splinter admin. */
export async function isQaChannelMemberWithFullAccess(env: Env, userId: number): Promise<boolean> {
  if (!qaMembersFullAccess(env)) return false;

  const cacheKey = `${MEMBER_CACHE_PREFIX}${userId}`;
  const cached = await env.SESSIONS.get(cacheKey);
  if (cached === '1') return true;
  if (cached === '0') return false;

  const chatIds = [...(await getAllQaChatIds(env)), ...parseDojoChatIds(env)];
  const unique = [...new Set(chatIds)];

  for (const chatId of unique) {
    if (await isMemberOfChat(env, chatId, userId)) {
      await env.SESSIONS.put(cacheKey, '1', { expirationTtl: MEMBER_CACHE_TTL_SECONDS });
      return true;
    }
  }

  await env.SESSIONS.put(cacheKey, '0', { expirationTtl: 3600 });
  return false;
}
