import { browserLabel } from './browsers';
import type { BrowserKey } from './browsers';
import { deviceDisplayLabel } from './devices';
import type { DeviceKey } from './devices';
import { escapeHtml, formatBoardLine, formatCardUpdateMessage, formatReporterMention } from './telegram-format';
import { sendMessage } from './telegram';
import { resolveBotUsername } from './bot-identity';
import {
  miniAppStartParam,
  productFeedbackButton,
  reportBugButton,
  wishlistButton,
} from './mini-app-buttons';
import { PRODUCT_FEATURE_AREA_LABELS } from './product/types';
import type { ProductFeatureArea } from './product/types';
import type { Env, ReportType } from './types';
import { REPORT_TYPE_LABELS } from './types';
import { parseQaChatIds, primaryQaChatId } from './qa-chats';

function keyboardFallbackHint(env: Env, startapp: string): string {
  const bot = resolveBotUsername(env);
  return `Open the Mini App: https://t.me/${bot}?startapp=${encodeURIComponent(startapp)}`;
}

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
    listLine?: string;
    featureArea?: ProductFeatureArea;
  },
): Promise<void> {
  const chatIds = parseQaChatIds(env);
  if (chatIds.length === 0) return;

  const mention = formatReporterMention(input);
  const devicePart = deviceDisplayLabel(
    input.device,
    input.browser ? browserLabel(input.browser) : undefined,
  );

  const typeLabel = REPORT_TYPE_LABELS[input.type];
  const areaLabel = input.featureArea ? PRODUCT_FEATURE_AREA_LABELS[input.featureArea] : undefined;
  const subtitleParts = [`<b>${escapeHtml(typeLabel)}</b>`, escapeHtml(devicePart)];
  if (areaLabel) subtitleParts.splice(1, 0, escapeHtml(areaLabel));

  const text = formatCardUpdateMessage({
    headline: input.type === 'product' ? 'New product feedback' : 'New triage card',
    title: input.title,
    subtitle: subtitleParts.join(' · '),
    boardLine: formatBoardLine(env),
    listLine: input.listLine ?? 'List: INBOX',
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

/** QA channel / group keyboards — never web_app (Telegram rejects in groups). */
export function channelTriggerKeyboard(env: Env, chatType?: string) {
  return channelStartAppKeyboard(env, chatType);
}

export function channelStartAppKeyboard(env: Env, chatType?: string) {
  const groupType = chatType ?? 'supergroup';
  return {
    inline_keyboard: [
      [reportBugButton(env, groupType)],
      [wishlistButton(env, groupType)],
    ],
  };
}

export function channelKeyboardWithProduct(
  env: Env,
  productLabel: string,
  productSlug: string,
  chatType?: string,
) {
  const groupType = chatType ?? 'supergroup';
  return {
    inline_keyboard: [
      [productFeedbackButton(env, `Product: ${productLabel}`, productSlug, groupType)],
      [reportBugButton(env, groupType)],
      [wishlistButton(env, groupType)],
    ],
  };
}

export function openAppPromptMarkup(
  env: Env,
  chatType?: string,
  productSlug?: string,
  productLabel?: string,
) {
  if (productSlug && productLabel) {
    return channelKeyboardWithProduct(env, productLabel, productSlug, chatType);
  }
  return channelTriggerKeyboard(env, chatType);
}

export function openAppFallbackText(env: Env, kind: 'bug' | 'wishlist' | 'product', slug?: string): string {
  if (kind === 'product' && slug) {
    return keyboardFallbackHint(env, miniAppStartParam('product', slug));
  }
  return keyboardFallbackHint(env, miniAppStartParam(kind));
}
