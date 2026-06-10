import { DOJO_GRANT_CMD, handleDojoGrantCommand } from '../dojo-access';
import { handleAdminSplinterChat, handleMasterSplinterCommand } from '../splinter/handlers';
import { handleUnauthorizedSplinterSummon } from '../splinter/intruder';
import { handleBotMessage } from '../bot-handlers';
import { isAdminUser, isAllowedChat, isBlockedUser, sendMessage } from '../telegram';
import { commandToken, isReporterCommand, isUtilityCommand } from './registry';
import { resolveBotUsername } from '../bot-identity';
import type { Env, TelegramMessage, TelegramUpdate } from '../types';

async function handleUtilityCommand(env: Env, message: TelegramMessage): Promise<boolean> {
  const text = message.text?.trim() ?? '';
  const token = commandToken(text);
  const chatId = message.chat.id;
  const from = message.from;
  if (!from) return false;

  if (token === '/chatid') {
    await sendMessage(
      env,
      chatId,
      [`Chat ID: ${chatId}`, `Type: ${message.chat.type}`].join('\n'),
    );
    return true;
  }

  if (token === '/myid') {
    const lines = [`Your user ID: ${from.id}`];
    if (from.username) lines.push(`Username: @${from.username}`);
    await sendMessage(env, chatId, lines.join('\n'));
    return true;
  }

  if (token === DOJO_GRANT_CMD) {
    await handleDojoGrantCommand(env, message);
    return true;
  }

  return false;
}

/**
 * Route a Telegram message after idempotency and callback filtering.
 * Order: utilities → Master Splinter (any chat) → QA gate → intruder tease → triage bot.
 */
export async function dispatchTelegramMessage(
  env: Env,
  message: TelegramMessage,
  executionCtx: ExecutionContext,
): Promise<void> {
  const text = message.text?.trim() ?? '';
  const userId = message.from?.id;
  if (!userId) return;

  if (isBlockedUser(env, userId, message.from?.username)) {
    return;
  }

  if (isUtilityCommand(text)) {
    await handleUtilityCommand(env, message);
    return;
  }

  if (await handleMasterSplinterCommand(env, message, executionCtx)) return;

  if (await handleAdminSplinterChat(env, message, executionCtx)) return;

  const inQaChannel = isAllowedChat(env, message.chat.id, message.chat.type);
  const adminDm =
    message.chat.type === 'private' &&
    (await isAdminUser(env, userId, message.from?.username));
  if (!inQaChannel && !adminDm) {
    if (isReporterCommand(text)) {
      const bot = resolveBotUsername(env);
      await sendMessage(
        env,
        message.chat.id,
        [
          'This chat is not registered as a WLTH QA channel.',
          `Chat ID: <code>${message.chat.id}</code>`,
          'Ask the admin to add it to <code>TELEGRAM_QA_CHAT_ID</code> (comma-separated for multiple channels).',
          `In groups with privacy mode, use <code>/report@${bot}</code>, <code>/product@${bot}</code>, or <code>/master_splinter@${bot}</code>.`,
        ].join('\n'),
        { parseMode: 'HTML' },
      );
    }
    return;
  }

  if (await handleUnauthorizedSplinterSummon(env, message)) return;

  await handleBotMessage(env, message);
}

export async function dispatchTelegramUpdate(
  env: Env,
  update: TelegramUpdate,
  executionCtx: ExecutionContext,
): Promise<void> {
  if (update.callback_query) return;
  const message = update.message;
  if (!message?.from) return;
  await dispatchTelegramMessage(env, message, executionCtx);
}
