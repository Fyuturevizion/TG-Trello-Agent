export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Convert agent markdown (##, **, `, links, bullets) to Telegram HTML. */
export function markdownToTelegramHtml(markdown: string): string {
  return markdown
    .split('\n')
    .map((line) => formatMarkdownLine(line))
    .join('\n');
}

function formatInlineMarkdown(text: string): string {
  if (!text) return '';
  const parts: string[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(escapeHtml(text.slice(last, match.index)));
    const token = match[0];
    if (token.startsWith('`')) {
      parts.push(`<code>${escapeHtml(token.slice(1, -1))}</code>`);
    } else if (token.startsWith('**')) {
      parts.push(`<b>${escapeHtml(token.slice(2, -2))}</b>`);
    } else {
      const link = token.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (link) {
        parts.push(`<a href="${escapeHtml(link[2])}">${escapeHtml(link[1])}</a>`);
      }
    }
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(escapeHtml(text.slice(last)));
  return parts.join('');
}

function formatMarkdownLine(line: string): string {
  const header = line.match(/^#{1,3}\s+(.*)$/);
  if (header) return `<b>${formatInlineMarkdown(header[1])}</b>`;

  const bullet = line.match(/^[-*]\s+(.*)$/);
  if (bullet) return `• ${formatInlineMarkdown(bullet[1])}`;

  if (!line.trim()) return '';
  return formatInlineMarkdown(line);
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

