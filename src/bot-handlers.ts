import { channelTriggerKeyboard } from './channel';
import { clearSession } from './session';
import {
  commandFromBotMention,
  isAdminUser,
  normalizeCommand,
  pinChatMessage,
  sendMessage,
} from './telegram';
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
  const chatId = Number(env.TELEGRAM_QA_CHAT_ID);
  if (!Number.isFinite(chatId)) {
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

function helpMessageLines(env: Env, userId: number): string[] {
  const lines = [
    'WLTH Triage Bot',
    '',
    'Submit bugs and wishlist items via the Mini App. One channel post per report.',
    '',
    'Tap the pinned Report bug / Wishlist buttons, or use:',
    '/report, /bug, /wishlist — open the form',
    '/help — this message',
    '',
    '/chatid — show this chat ID',
    '/myid — show your Telegram user ID',
  ];
  if (isAdminUser(env, userId)) {
    lines.push('', '/setup — refresh pinned buttons in QA channel', '/master-splinter — maintain this bot (see /master-splinter help)');
  }
  return lines;
}

export async function handleBotMessage(env: Env, message: TelegramMessage): Promise<void> {
  const text = message.text?.trim() ?? '';
  const command = commandFromBotMention(text) ?? normalizeCommand(text);
  const chatId = message.chat.id;
  const userId = message.from?.id;
  if (!userId) return;

  if (command === '/cancel') {
    await clearSession(env, chatId, userId);
    await sendMessage(env, chatId, 'Cancelled.');
    return;
  }

  if (command === '/setup') {
    if (!isAdminUser(env, userId)) {
      await sendMessage(env, chatId, 'Only the bot admin can run /setup.');
      return;
    }
    await postChannelTriggers(env);
    await sendMessage(env, chatId, 'Posted (and pinned if bot is admin) channel trigger buttons.');
    return;
  }

  if (command === '/start' || command === '/help') {
    await sendMessage(env, chatId, helpMessageLines(env, userId).join('\n'), {
      replyMarkup: channelTriggerKeyboard(env),
    });
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
