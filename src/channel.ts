import { browserLabel } from './browsers';
import type { BrowserKey } from './browsers';
import { deviceDisplayLabel } from './devices';
import type { DeviceKey } from './devices';
import { listActiveProducts } from './products';
import { PRODUCT_FEEDBACK_TYPE_LABELS } from './products';
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

export async function announceProductFeedback(
  env: Env,
  input: {
    productName: string;
    featureLabel: string;
    feedbackType: string;
    title: string;
    shortUrl: string;
    reporterUsername?: string;
    reporterId: number;
    reporterFirstName?: string;
  },
): Promise<void> {
  const chatId = Number(env.TELEGRAM_QA_CHAT_ID);
  if (!Number.isFinite(chatId)) return;

  const mention = formatReporterMention(input);
  const typeLabel = PRODUCT_FEEDBACK_TYPE_LABELS[input.feedbackType] ?? input.feedbackType;

  const text = formatCardUpdateMessage({
    headline: `${input.productName} feedback`,
    title: input.title,
    subtitle: `<b>${escapeHtml(typeLabel)}</b> · ${escapeHtml(input.featureLabel)}`,
    boardLine: formatBoardLine(env),
    listLine: 'Added to product feedback card',
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

/** Admin-only sample DM matching Mobile / PWA Review list notifications. */
export async function sendTestReviewDm(env: Env, recipientId: number): Promise<boolean> {
  const text = formatCardUpdateMessage({
    headline: 'Please test this update',
    title: '\'slice" changed to capital "Slice" in Gifting coming soon modal.',
    subtitle:
      'Your report was moved to <b>Mobile - Review</b>. Please test the update and report back in the QA channel if anything still looks wrong.',
    boardLine: formatBoardLine(env, { name: 'Development' }),
    listLine: 'List: In Progress → Mobile - Review',
    shortUrl: TEST_CARD_URL,
    createdBy: '@Connor13all',
  }).join('\n');

  await sendMessage(env, recipientId, text, { parseMode: 'HTML' });
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
  const page = query?.product ? `${base}/product.html` : base;
  return webappUrlWithVersion(page, query);
}

const BOT_USERNAME = 'WLTH_Triage_Bot';

/** Opens via BotFather main Mini App (needs Configure Mini App URL + cache bust ?ui=). */
export async function channelTriggerKeyboard(env: Env) {
  return channelStartAppKeyboard(await listActiveProducts(env));
}

export function channelStartAppKeyboard(activeProducts: Array<{ slug: string; displayName: string }> = []) {
  const rows: Array<Array<{ text: string; url: string }>> = [
    [{ text: 'Report bug', url: `https://t.me/${BOT_USERNAME}?startapp=bug` }],
    [{ text: 'Wishlist', url: `https://t.me/${BOT_USERNAME}?startapp=wishlist` }],
  ];

  for (const product of activeProducts) {
    rows.push([
      {
        text: `${product.displayName} feedback`,
        url: `https://t.me/${BOT_USERNAME}?startapp=product_${product.slug}`,
      },
    ]);
  }

  return { inline_keyboard: rows };
}

export function channelWebAppKeyboard(env: Env) {
  return {
    inline_keyboard: [
      [{ text: 'Report bug', web_app: { url: webAppUrl(env, { type: 'bug' }) } }],
      [{ text: 'Wishlist', web_app: { url: webAppUrl(env, { type: 'wishlist' }) } }],
    ],
  };
}
