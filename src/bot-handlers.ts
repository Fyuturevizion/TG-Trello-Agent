import { channelTriggerKeyboard } from './channel';
import { findCommandInText } from './commands/registry';
import { handleProductMessage } from './product/handlers';
import { primaryQaChatId } from './qa-chats';
import { clearSession } from './session';
import { isAdminUser, normalizeCommand, pinChatMessage, sendMessage } from './telegram';
import type { Env, TelegramMessage } from './types';

const TRIAGE_OPEN_COMMANDS = ['/report', '/bug', '/wishlist'] as const;

export async function sendOpenAppPrompt(
  env: Env,
  chatId: number,
  intro?: string,
): Promise<void> {
  await sendMessage(env, chatId, intro ?? 'WLTH QA triage — open the form:', {
    replyMarkup: await channelTriggerKeyboard(env),
  });
}

export async function postChannelTriggers(env: Env): Promise<void> {
  const chatId = primaryQaChatId(env);
  if (chatId === null) {
    throw new Error('TELEGRAM_QA_CHAT_ID is not set');
  }

  const sent = await sendMessage(
    env,
    chatId,
    [
      'WLTH QA Triage',
      '',
      'Tap a button to open the report form. One message is posted here when a card is submitted.',
    ].join('\n'),
    { replyMarkup: await channelTriggerKeyboard(env) },
  );

  try {
    await pinChatMessage(env, chatId, sent.message_id);
  } catch {
    // Bot may need admin rights to pin
  }
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
    if (!(await isAdminUser(env, userId))) {
      await sendMessage(env, chatId, 'Only the bot admin can run /setup.');
      return true;
    }
    await postChannelTriggers(env);
    await sendMessage(env, chatId, 'Posted (and pinned if bot is admin) channel trigger buttons.');
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
        '/setup — post pinned buttons in QA channel (admin)',
        '/chatid — show this chat ID',
        '/myid — show your Telegram user ID',
        '/product — product feedback (when a round is open)',
      ].join('\n'),
      { replyMarkup: await channelTriggerKeyboard(env) },
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
    await sendOpenAppPrompt(env, chatId, hint);
    return true;
  }

  return false;
}
