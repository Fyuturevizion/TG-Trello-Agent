import { browserLabel } from './browsers';
import type { BrowserKey } from './browsers';
import { deviceDisplayLabel } from './devices';
import type { DeviceKey } from './devices';
import { escapeHtml, formatBoardLine, formatCardUpdateMessage, formatReporterMention } from './telegram-format';
import { sendMessage } from './telegram';
import type { Env, ReportType } from './types';
import { REPORT_TYPE_LABELS } from './types';
import { resolveBotUsername } from './bot-identity';
import { loadActiveProduct } from './product/session';
import { parseQaChatIds, primaryQaChatId } from './qa-chats';
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
  const chatIds = parseQaChatIds(env);
  if (chatIds.length === 0) return;

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

  for (const chatId of chatIds) {
    await sendMessage(env, chatId, text, { parseMode: 'HTML' });
  }
}

const TEST_CARD_URL = 'https://trello.com/c/8kTHpNjt';

/** Admin-only sample notification for verifying HTML card links in the QA channel. */
export async function sendTestCardUpdate(env: Env): Promise<boolean> {
  const chatId = primaryQaChatId(env);
  if (chatId === null) return false;

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
  const chatIds = parseQaChatIds(env);
  if (chatIds.length === 0) return;

  const text = lines.join('\n');
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
export async function channelTriggerKeyboard(env: Env) {
  return channelStartAppKeyboard(env);
}

export async function channelStartAppKeyboard(env: Env) {
  const bot = resolveBotUsername(env);
  const rows: Array<Array<{ text: string; url?: string; web_app?: { url: string } }>> = [
    [{ text: 'Report bug', url: `https://t.me/${bot}?startapp=bug` }],
    [{ text: 'Wishlist', url: `https://t.me/${bot}?startapp=wishlist` }],
  ];

  const active = await loadActiveProduct(env);
  if (active) {
    const productUrl = webappUrlWithVersion(env.WEBAPP_URL ?? '', { mode: 'product' });
    rows.push([{ text: `${active.displayName} feedback`, web_app: { url: productUrl } }]);
  }

  return { inline_keyboard: rows };
}

