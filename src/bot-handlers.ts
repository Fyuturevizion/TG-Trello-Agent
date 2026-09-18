import { channelTriggerKeyboard, postChannelTriggersToChat } from './channel';
import { messageThreadId, sendThreadOptions } from './telegram-message';
import { setReportThreadId, TELEGRAM_GENERAL_TOPIC_ID } from './qa-threads';
import { findCommandInText } from './commands/registry';
import { handleProductMessage } from './product/handlers';
import { addExtraQaChatId } from './qa-chats';
import { clearSession } from './session';
import { isAdminUser, normalizeCommand, sendMessage } from './telegram';
import type { Env, TelegramMessage } from './types';

const TRIAGE_OPEN_COMMANDS = ['/report', '/bug', '/wishlist'] as const;

export async function sendOpenAppPrompt(
  env: Env,
  chatId: number,
  intro?: string,
  threadId?: number,
): Promise<void> {
  const origin = { chatId, messageThreadId: threadId };
  await sendMessage(env, chatId, intro ?? 'WLTH QA triage — open the form:', {
    replyMarkup: await channelTriggerKeyboard(env, origin),
    ...(threadId ? { messageThreadId: threadId } : {}),
  });
}

export async function postChannelTriggers(env: Env, chatId: number): Promise<void> {
  await postChannelTriggersToChat(env, chatId);
}

/** Handle triage bot commands. Returns true when the message was consumed. */
export async function handleBotMessage(env: Env, message: TelegramMessage): Promise<boolean> {
  const text = message.text?.trim() ?? '';
  const command = normalizeCommand(text.split(/\s+/)[0] ?? '');
  const chatId = message.chat.id;
  const userId = message.from?.id;
  if (!userId) return false;

  if (command === '/product' || text.toLowerCase().startsWith('/product ')) {
    await handleProductMessage(env, message);
    return true;
  }

  if (command === '/cancel') {
    await clearSession(env, chatId, userId);
    await sendMessage(env, chatId, 'Cancelled.');
    return true;
  }

  if (command === '/setup') {
    if (!(await isAdminUser(env, userId, message.from?.username))) {
      await sendMessage(env, chatId, 'Only the bot admin can run /setup.');
      return true;
    }
    await addExtraQaChatId(env, chatId);
    const thread = messageThreadId(message);
    if (thread && thread !== TELEGRAM_GENERAL_TOPIC_ID) {
      await setReportThreadId(env, chatId, thread);
    }
    await postChannelTriggersToChat(env, chatId, thread);
    await sendMessage(
      env,
      chatId,
      'Posted (and pinned if bot is admin) channel trigger buttons. This chat is registered for QA triage.',
      thread ? { messageThreadId: thread } : {},
    );
    return true;
  }

  if (command === '/start' || command === '/help') {
    await sendMessage(
      env,
      chatId,
      [
        'WLTH Triage Bot',
        '',
        'Use the Mini App to submit bugs — one channel post per report.',
        '',
        '/report — open form',
        '/setup — post pinned buttons in this chat (admin)',
        '/chatid — show this chat ID',
        '/myid — show your Telegram user ID',
        '/product — product feedback (when a round is open)',
      ].join('\n'),
      {
        replyMarkup: await channelTriggerKeyboard(env, {
          chatId,
          messageThreadId: messageThreadId(message),
        }),
        ...sendThreadOptions(message),
      },
    );
    return true;
  }

  const openCmd =
    findCommandInText(text, TRIAGE_OPEN_COMMANDS) ??
    (TRIAGE_OPEN_COMMANDS.includes(command as (typeof TRIAGE_OPEN_COMMANDS)[number])
      ? command
      : null);

  if (openCmd) {
    const hint =
      openCmd === '/bug'
        ? 'Bug report — open the form:'
        : openCmd === '/wishlist'
          ? 'Wishlist — open the form:'
          : 'Open the triage form:';
    await sendOpenAppPrompt(env, chatId, hint, messageThreadId(message));
    return true;
  }

  return false;
}
