import type { CardReporter } from './card-reporter';

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Clickable "link to the card" label for Telegram HTML messages. */
export function formatTrelloUrlLink(shortUrl?: string): string {
  const url = shortUrl?.trim();
  if (!url) return '';
  return `<a href="${escapeHtml(url)}">link to the card</a>`;
}

export function formatBoardLine(
  env: { TRELLO_BOARD_NAME?: string },
  board?: { name?: string },
  boardBefore?: { name?: string },
): string {
  const to = board?.name ? escapeHtml(board.name) : undefined;
  const from = boardBefore?.name ? escapeHtml(boardBefore.name) : undefined;
  const fallback = escapeHtml(env.TRELLO_BOARD_NAME?.trim() || 'Support/Triage');
  if (from && to && from !== to) return `Board: ${from} → ${to}`;
  if (to) return `Board: ${to}`;
  return `Board: ${fallback}`;
}

export function formatListLine(
  listAfter?: { name?: string },
  listBefore?: { name?: string },
): string | undefined {
  const to = listAfter?.name ? escapeHtml(listAfter.name) : undefined;
  const from = listBefore?.name ? escapeHtml(listBefore.name) : undefined;
  if (from && to && from !== to) return `List: ${from} → ${to}`;
  if (to) return `List: ${to}`;
  if (from) return `List: ${from}`;
  return undefined;
}

export interface CardUpdateMessage {
  headline?: string;
  title: string;
  subtitle?: string;
  boardLine: string;
  listLine?: string;
  shortUrl?: string;
  updatedBy?: string;
  createdBy?: string;
}

/** Standard QA channel format for Trello card updates. */
export function formatCardUpdateMessage(msg: CardUpdateMessage): string[] {
  const lines: string[] = [];
  if (msg.headline) {
    lines.push(`<b>${escapeHtml(msg.headline)}</b>`, '');
  }
  lines.push(escapeHtml(msg.title));
  if (msg.subtitle) {
    lines.push(msg.subtitle);
  }
  lines.push('', msg.boardLine);
  if (msg.listLine) {
    lines.push(msg.listLine);
  }
  const link = formatTrelloUrlLink(msg.shortUrl);
  if (link) {
    lines.push('', link);
  }
  if (msg.updatedBy) {
    lines.push('', `Updated by ${msg.updatedBy}`);
  }
  if (msg.createdBy) {
    lines.push(`Created by ${msg.createdBy}`);
  }
  return lines;
}

/** Clickable Trello card label for Telegram HTML messages. */
export function formatTrelloCardLink(name: string, shortUrl?: string): string {
  const safeName = escapeHtml(name);
  const url = shortUrl?.trim();
  if (!url) return safeName;
  return `<a href="${escapeHtml(url)}">${safeName}</a>`;
}

/** Mention reporter in QA channel (HTML parse mode). */
export function formatReporterMention(reporter: {
  reporterId: number;
  reporterUsername?: string;
  reporterFirstName?: string;
}): string {
  if (reporter.reporterUsername) {
    return `@${escapeHtml(reporter.reporterUsername)}`;
  }
  const label = escapeHtml(reporter.reporterFirstName ?? 'Reporter');
  return `<a href="tg://user?id=${reporter.reporterId}">${label}</a>`;
}

export function reporterFromCardRecord(record: CardReporter): string {
  return formatReporterMention(record);
}
