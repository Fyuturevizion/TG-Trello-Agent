import { browserLabel } from './browsers';
import type { BrowserKey } from './browsers';
import type { CardReporter } from './card-reporter';
import { deviceDisplayLabel } from './devices';
import type { DeviceKey } from './devices';
import { escapeHtml, formatReporterMention } from './telegram-format';
import { sendMessage } from './telegram';
import type { Env, ReportType } from './types';
import { REPORT_TYPE_LABELS } from './types';
import { resolveBotUsername } from './bot-identity';
import { parseQaChatIds } from './qa-chats';

export async function announceNewCard(
  env: Env,
  input: {
    type: ReportType;
    device: DeviceKey;
    browser?: BrowserKey;
    title: string;
    cardName: string;
    shortUrl: string;
    reporterUsername?: string;
    reporterId: number;
    reporterFirstName?: string;
  },
): Promise<void> {
  const chatIds = parseQaChatIds(env);
  if (chatIds.length === 0) return;

  const mention = formatReporterMention(input);
  const devicePart = deviceDisplayLabel(
    input.device,
    input.browser ? browserLabel(input.browser) : undefined,
  );

  const text = [
    `✅ New triage card — ${mention}`,
    '',
    `<b>${escapeHtml(REPORT_TYPE_LABELS[input.type])}</b> · ${escapeHtml(devicePart)}`,
    escapeHtml(input.title),
    '',
    escapeHtml(input.shortUrl),
  ].join('\n');

  for (const chatId of chatIds) {
    await sendMessage(env, chatId, text, { parseMode: 'HTML' });
  }
}

export async function announceTrelloEvent(
  env: Env,
  lines: string[],
  reporter?: CardReporter | null,
): Promise<void> {
  const chatIds = parseQaChatIds(env);
  if (chatIds.length === 0) return;

  let text = lines.join('\n');
  if (reporter) {
    const mention = formatReporterMention(reporter);
    text = `${text}\n\nReporter: ${mention}`;
  }

  for (const chatId of chatIds) {
    await sendMessage(env, chatId, text, { parseMode: 'HTML' });
  }
}

export async function notifyReporterDm(
  env: Env,
  reporterId: number,
  text: string,
): Promise<void> {
  try {
    await sendMessage(env, reporterId, text, { parseMode: 'HTML' });
  } catch {
    // User may not have started the bot
  }
}

/** Opens via BotFather main Mini App (needs Configure Mini App URL + cache bust ?ui=). */
export function channelTriggerKeyboard(env: Env) {
  return channelStartAppKeyboard(env);
}

export function channelStartAppKeyboard(env: Env) {
  const bot = resolveBotUsername(env);
  return {
    inline_keyboard: [
      [{ text: 'Report bug', url: `https://t.me/${bot}?startapp=bug` }],
      [{ text: 'Wishlist', url: `https://t.me/${bot}?startapp=wishlist` }],
    ],
  };
}

