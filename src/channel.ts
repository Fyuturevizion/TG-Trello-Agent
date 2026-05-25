import { browserLabel } from './browsers';
import type { BrowserKey } from './browsers';
import { deviceDisplayLabel } from './devices';
import type { DeviceKey } from './devices';
import { escapeHtml, formatBoardLine, formatCardUpdateMessage, formatReporterMention } from './telegram-format';
import { sendMessage } from './telegram';
import type { Env, ReportType } from './types';
import { REPORT_TYPE_LABELS } from './types';
import { webappUrlWithVersion } from './webapp-version';

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
  const chatId = Number(env.TELEGRAM_QA_CHAT_ID);
  if (!Number.isFinite(chatId)) return;

  const mention = formatReporterMention(input);
  const devicePart = deviceDisplayLabel(
    input.device,
    input.browser ? browserLabel(input.browser) : undefined,
  );

  const text = formatCardUpdateMessage({
    headline: 'New triage card',
    title: input.title,
    subtitle: `<b>${escapeHtml(REPORT_TYPE_LABELS[input.type])}</b> · ${escapeHtml(devicePart)}`,
    boardLine: formatBoardLine(env),
    listLine: 'List: INBOX',
    shortUrl: input.shortUrl,
    createdBy: mention,
  }).join('\n');

  await sendMessage(env, chatId, text, { parseMode: 'HTML' });
}

const TEST_CARD_URL = 'https://trello.com/c/8kTHpNjt';

/** Admin-only sample notification for verifying HTML card links in the QA channel. */
export async function sendTestCardUpdate(env: Env): Promise<boolean> {
  const chatId = Number(env.TELEGRAM_QA_CHAT_ID);
  if (!Number.isFinite(chatId)) return false;

  const text = formatCardUpdateMessage({
    headline: 'List updated (test)',
    title: '\'slice" changed to capital "Slice" in Gifting coming soon modal.',
    boardLine: formatBoardLine(env, { name: 'Development' }),
    listLine: 'List: Backlog → In Progress',
    shortUrl: TEST_CARD_URL,
    updatedBy: '@iainmckie',
    createdBy: '@Connor13all',
  }).join('\n');

  await sendMessage(env, chatId, text, { parseMode: 'HTML' });
  return true;
}

export async function announceTrelloEvent(
  env: Env,
  lines: string[],
): Promise<void> {
  const chatId = Number(env.TELEGRAM_QA_CHAT_ID);
  if (!Number.isFinite(chatId)) return;

  await sendMessage(env, chatId, lines.join('\n'), { parseMode: 'HTML' });
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

export function webAppUrl(env: Env, query?: Record<string, string>): string {
  const base = (env.WEBAPP_URL ?? '').replace(/\/$/, '');
  if (!base) return '/';
  return webappUrlWithVersion(base, query);
}

const BOT_USERNAME = 'WLTH_Triage_Bot';

/** Opens via BotFather main Mini App (needs Configure Mini App URL + cache bust ?ui=). */
export function channelTriggerKeyboard(_env: Env) {
  return channelStartAppKeyboard();
}

export function channelStartAppKeyboard() {
  return {
    inline_keyboard: [
      [{ text: 'Report bug', url: `https://t.me/${BOT_USERNAME}?startapp=bug` }],
      [{ text: 'Wishlist', url: `https://t.me/${BOT_USERNAME}?startapp=wishlist` }],
    ],
  };
}

export function channelWebAppKeyboard(env: Env) {
  return {
    inline_keyboard: [
      [{ text: 'Report bug', web_app: { url: webAppUrl(env, { type: 'bug' }) } }],
      [{ text: 'Wishlist', web_app: { url: webAppUrl(env, { type: 'wishlist' }) } }],
    ],
  };
}
