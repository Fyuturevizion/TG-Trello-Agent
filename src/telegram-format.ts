import type { CardReporter } from './card-reporter';

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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
