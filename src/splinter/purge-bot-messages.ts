import { clearBotMessageLog, loadBotMessageIds } from '../bot-message-log';
import {
  deleteMessage,
  editMessageReplyMarkup,
  getBotUserId,
  getChatMember,
  sendMessage,
} from '../telegram';
import type { Env } from '../types';

const EMPTY_MARKUP = { inline_keyboard: [] as [] };

async function botCanDeleteOthersMessages(env: Env, chatId: number): Promise<boolean> {
  try {
    const botId = await getBotUserId(env);
    const member = await getChatMember(env, chatId, botId);
    if (member.status !== 'administrator') return false;
    return Boolean((member as { can_delete_messages?: boolean }).can_delete_messages);
  } catch {
    return false;
  }
}

function isTelegramError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** True when Telegram says the message is ours (editable) even if markup did not change. */
function isOwnedMessageProbeError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('message is not modified') || lower.includes("message can't be edited");
}

async function isBotOwnedMessage(
  env: Env,
  chatId: number,
  messageId: number,
  messageThreadId: number | undefined,
): Promise<boolean> {
  try {
    await editMessageReplyMarkup(env, chatId, messageId, EMPTY_MARKUP, messageThreadId);
    return true;
  } catch (error) {
    const msg = isTelegramError(error);
    if (isOwnedMessageProbeError(msg)) return true;
    return false;
  }
}

export interface PurgeBotMessagesResult {
  deleted: number;
  scanned: number;
  fromLog: number;
}

/** Delete only this bot's messages in a chat or forum topic (never other people's lines). */
export async function purgeBotMessagesInChat(
  env: Env,
  chatId: number,
  scanCountRaw: string | undefined,
  messageThreadId?: number,
): Promise<PurgeBotMessagesResult> {
  const scanCount = Math.min(Math.max(Number(scanCountRaw ?? '1200') || 1200, 50), 3000);
  const opts = messageThreadId ? { messageThreadId } : {};
  const canDeleteOthers = await botCanDeleteOthersMessages(env, chatId);

  let deleted = 0;
  let fromLog = 0;

  const loggedIds = await loadBotMessageIds(env, chatId, messageThreadId);
  for (const id of loggedIds) {
    try {
      await deleteMessage(env, chatId, id, messageThreadId);
      deleted++;
      fromLog++;
    } catch {
      // already gone
    }
  }
  await clearBotMessageLog(env, chatId, messageThreadId);

  const anchor = await sendMessage(env, chatId, '…', opts);
  let scanned = 0;

  for (let id = anchor.message_id; id > anchor.message_id - scanCount; id--) {
    scanned++;
    if (canDeleteOthers) {
      const owned = await isBotOwnedMessage(env, chatId, id, messageThreadId);
      if (!owned) continue;
    }
    try {
      await deleteMessage(env, chatId, id, messageThreadId);
      deleted++;
    } catch {
      // not our message, missing, or too old
    }
  }

  return { deleted, scanned, fromLog };
}

export async function handleMasterSplinterPurgeBotMessages(
  env: Env,
  chatId: number,
  scanCountRaw: string | undefined,
  messageThreadId?: number,
): Promise<void> {
  const opts = messageThreadId ? { messageThreadId } : {};
  const result = await purgeBotMessagesInChat(env, chatId, scanCountRaw, messageThreadId);
  await sendMessage(
    env,
    chatId,
    `I cleared ${result.deleted} of my own messages in this thread, my student. Your words stay on the wall. We can start fresh.`,
    opts,
  );
}
