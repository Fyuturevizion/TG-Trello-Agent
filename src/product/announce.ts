import { escapeHtml, formatBoardLine, formatTrelloUrlLink } from '../telegram-format';
import { sendMessage } from '../telegram';
import { getAllQaChatIds } from '../qa-chats';
import type { Env } from '../types';

export async function announceProductOpened(
  env: Env,
  input: { displayName: string; shortUrl: string },
): Promise<void> {
  const chatIds = await getAllQaChatIds(env);
  if (chatIds.length === 0) return;

  const link = formatTrelloUrlLink(input.shortUrl);
  const text = [
    `<b>Product feedback open: ${escapeHtml(input.displayName)}</b>`,
    '',
    'Use the channel <b>Product feedback</b> button or send <code>/product</code>.',
    'All notes land on one Trello card as checklist items.',
    '',
    link,
  ].join('\n');

  for (const chatId of chatIds) {
    await sendMessage(env, chatId, text, { parseMode: 'HTML' });
  }
}

export async function announceProductClosed(env: Env, displayName: string): Promise<void> {
  const chatIds = await getAllQaChatIds(env);
  if (chatIds.length === 0) return;

  const text = [
    `<b>Product feedback closed: ${escapeHtml(displayName)}</b>`,
    '',
    'The feedback hub is closed. Bug/wishlist triage continues as usual.',
  ].join('\n');

  for (const chatId of chatIds) {
    await sendMessage(env, chatId, text, { parseMode: 'HTML' });
  }
}

export async function announceProductFeedback(
  env: Env,
  input: {
    displayName: string;
    areaLabel: string;
    title: string;
    shortUrl: string;
    reporterUsername?: string;
    reporterId: number;
    reporterFirstName?: string;
  },
): Promise<void> {
  const chatIds = await getAllQaChatIds(env);
  if (chatIds.length === 0) return;

  const who = input.reporterUsername
    ? `@${escapeHtml(input.reporterUsername)}`
    : escapeHtml(input.reporterFirstName ?? `user ${input.reporterId}`);
  const link = formatTrelloUrlLink(input.shortUrl);

  const text = [
    `<b>${escapeHtml(input.displayName)} feedback</b> · ${escapeHtml(input.areaLabel)}`,
    escapeHtml(input.title),
    '',
    who,
    '',
    link,
    '',
    formatBoardLine(env),
  ].join('\n');

  for (const chatId of chatIds) {
    await sendMessage(env, chatId, text, { parseMode: 'HTML' });
  }
}
