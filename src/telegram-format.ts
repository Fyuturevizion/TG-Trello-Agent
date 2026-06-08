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
