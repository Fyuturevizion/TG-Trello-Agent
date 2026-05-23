import type { CardReporter } from './card-reporter';

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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
