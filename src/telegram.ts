import { loadQaChatIds } from './qa-chats';
import type { Env } from './types';

const TELEGRAM_API = 'https://api.telegram.org';

/** Strips @BotUsername suffix from group commands (e.g. /report@WLTH_Triage_Bot). */
export function normalizeCommand(text: string): string {
  const trimmed = text.trim();
  const at = trimmed.indexOf('@');
  if (at === -1) return trimmed;
  return trimmed.slice(0, at);
}

export type InlineButton = {
  text: string;
  callback_data?: string;
  url?: string;
  web_app?: { url: string };
};

type InlineKeyboard = {
  inline_keyboard: Array<Array<InlineButton>>;
};

export type ReplyMarkup = InlineKeyboard | { remove_keyboard: true };

async function telegramRequest<T>(
  env: Env,
  method: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const url = `${TELEGRAM_API}/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await response.json()) as { ok: boolean; description?: string; result?: T };
  if (!data.ok) {
    throw new Error(`Telegram ${method} failed: ${data.description ?? response.statusText}`);
  }
  return data.result as T;
}

export async function sendMessage(
  env: Env,
  chatId: number,
  text: string,
  options?: {
    replyMarkup?: ReplyMarkup;
    parseMode?: 'Markdown' | 'HTML';
  },
): Promise<{ message_id: number }> {
  return telegramRequest(env, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: options?.parseMode,
    reply_markup: options?.replyMarkup,
  });
}

export async function editMessageText(
  env: Env,
  chatId: number,
  messageId: number,
  text: string,
  replyMarkup?: ReplyMarkup,
  parseMode?: 'HTML' | 'Markdown',
): Promise<void> {
  await telegramRequest(env, 'editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: parseMode,
    reply_markup: replyMarkup,
  });
}

export type ChatAction = 'typing' | 'upload_photo' | 'record_video' | 'upload_video';

export async function sendChatAction(env: Env, chatId: number, action: ChatAction): Promise<void> {
  await telegramRequest(env, 'sendChatAction', {
    chat_id: chatId,
    action,
  });
}

export async function deleteMessage(env: Env, chatId: number, messageId: number): Promise<void> {
  await telegramRequest(env, 'deleteMessage', {
    chat_id: chatId,
    message_id: messageId,
  });
}

export function inlineKeyboard(rows: Array<Array<InlineButton>>): InlineKeyboard {
  return { inline_keyboard: rows };
}

export async function pinChatMessage(
  env: Env,
  chatId: number,
  messageId: number,
): Promise<void> {
  await telegramRequest(env, 'pinChatMessage', {
    chat_id: chatId,
    message_id: messageId,
    disable_notification: true,
  });
}

export async function setChatMenuButton(env: Env, webAppUrl: string): Promise<void> {
  await telegramRequest(env, 'setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: 'Report to Trello',
      web_app: { url: webAppUrl },
    },
  });
}

export async function getWebhookInfo(env: Env): Promise<{
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
}> {
  return telegramRequest(env, 'getWebhookInfo', {});
}

export async function setWebhook(env: Env, webhookUrl: string): Promise<void> {
  await telegramRequest(env, 'setWebhook', {
    url: webhookUrl,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: false,
  });
}

export async function isAllowedChat(
  env: Env,
  chatId: number,
  chatType?: string,
): Promise<boolean> {
  const ids = await loadQaChatIds(env);
  if (ids.length > 0) return ids.includes(chatId);
  // Fallback if unset: any group/supergroup/channel the bot is in
  return chatType === 'group' || chatType === 'supergroup' || chatType === 'channel';
}

export { isAdminUser, isDojoKeeper, isCodeAdmin, canSummonSplinter } from './dojo-access';

function parseUserIdList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw.split(',').map((id) => id.trim()).filter(Boolean);
}

function parseUsernameList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((name) => name.trim().replace(/^@/, '').toLowerCase())
    .filter(Boolean);
}

/** Blocked users cannot use bot commands or submit reports via the Mini App. */
export function isBlockedUser(env: Env, userId: number, username?: string): boolean {
  const blockedIds = parseUserIdList(env.TELEGRAM_BLOCKED_USER_IDS);
  if (blockedIds.includes(String(userId))) return true;
  const blockedNames = parseUsernameList(env.TELEGRAM_BLOCKED_USERNAMES);
  if (username && blockedNames.includes(username.toLowerCase())) return true;
  return false;
}

/** Who may use /report, /help, etc. When unset, any member of the QA channel may. */
export function isAllowedUser(env: Env, userId: number): boolean {
  const ids = parseUserIdList(env.TELEGRAM_ALLOWED_USER_IDS);
  if (ids.length === 0) return true;
  return ids.includes(String(userId));
}
