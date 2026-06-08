import { channelTriggerKeyboard } from './channel';
import { primaryQaChatId } from './qa-chats';
import { clearSession } from './session';
import { isAdminUser, normalizeCommand, pinChatMessage, sendMessage } from './telegram';
import type { Env, TelegramMessage } from './types';

export async function sendOpenAppPrompt(
  env: Env,
  chatId: number,
  intro?: string,
): Promise<void> {
  await sendMessage(env, chatId, intro ?? 'WLTH QA triage — open the form:', {
    replyMarkup: channelTriggerKeyboard(env),
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
    { replyMarkup: channelTriggerKeyboard(env) },
  );

  try {
    await pinChatMessage(env, chatId, sent.message_id);
  } catch {
    // Bot may need admin rights to pin
  }
}

export async function handleBotMessage(env: Env, message: TelegramMessage): Promise<void> {
  const text = message.text?.trim() ?? '';
  const command = normalizeCommand(text);
  const chatId = message.chat.id;
  const userId = message.from?.id;
  if (!userId) return;

  if (command === '/cancel') {
    await clearSession(env, chatId, userId);
    await sendMessage(env, chatId, 'Cancelled.');
    return;
  }

  if (command === '/setup') {
    if (!(await isAdminUser(env, userId))) {
      await sendMessage(env, chatId, 'Only the bot admin can run /setup.');
      return;
    }
    await postChannelTriggers(env);
    await sendMessage(env, chatId, 'Posted (and pinned if bot is admin) channel trigger buttons.');
    return;
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
      ].join('\n'),
      { replyMarkup: channelTriggerKeyboard(env) },
    );
    return;
  }

  if (command === '/report' || command === '/bug' || command === '/wishlist') {
    const hint =
      command === '/bug'
        ? 'Bug report — open the form:'
        : command === '/wishlist'
          ? 'Wishlist — open the form:'
          : 'Open the triage form:';
    await sendOpenAppPrompt(env, chatId, hint);
    return;
  }
}
