import { MASTER_SPLINTER_CMD } from './command';
import { sanitizeSplinterReply } from './reply-sanitize';
import { isTerminalRunStatus, type CursorRun } from '../cursor-api';
import { escapeHtml, markdownToTelegramHtml } from '../telegram-format';
import { sendMessage } from '../telegram';
import type { Env } from '../types';

/** Telegram max is 4096; stay under for HTML overhead. */
const TELEGRAM_CHUNK = 3900;

function splitTelegram(text: string, maxLen = TELEGRAM_CHUNK): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf('\n', maxLen);
    if (cut < maxLen / 2) cut = maxLen;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

/** Drop legacy report headings if an older run still returns them. */
export function prepareSplinterReplyText(
  raw: string,
  git?: { branch?: string; prUrl?: string },
): string {
  return sanitizeSplinterReply(
    raw
      .replace(/^##\s*Answer\s*\n+/im, '')
      .replace(/^##\s*What changed\s*\n+/im, '')
      .replace(/^##\s*Links\s*\n+/im, '')
      .trim(),
    git,
  );
}

export function formatRunForTelegram(run: CursorRun): string {
  const git = run.git?.branches?.[0];
  let body = prepareSplinterReplyText(run.result?.trim() ?? '', {
    branch: git?.branch,
    prUrl: git?.prUrl,
  });
  if (!body) {
    body =
      run.status === 'FINISHED'
        ? 'My student, I have finished, but I have no words for you this time. Ask again.'
        : `My student, the run ended with status: ${run.status}.`;
  }

  return body;
}

async function sendSplinterReply(env: Env, chatId: number, markdownBody: string): Promise<void> {
  const trimmed = prepareSplinterReplyText(markdownBody);
  if (!trimmed) {
    await sendMessage(env, chatId, '(No reply text.)', { parseMode: 'HTML' });
    return;
  }

  const html = markdownToTelegramHtml(trimmed);
  const plainParts = splitTelegram(trimmed);
  const htmlParts = splitTelegram(html);

  for (let i = 0; i < htmlParts.length; i++) {
    const prefix =
      htmlParts.length > 1 && i > 0 ? `<i>(${i + 1}/${htmlParts.length})</i>\n\n` : '';
    try {
      await sendMessage(env, chatId, `${prefix}${htmlParts[i]}`, { parseMode: 'HTML' });
    } catch {
      const plainPrefix =
        plainParts.length > 1 && i > 0 ? `(${i + 1}/${plainParts.length})\n\n` : '';
      await sendMessage(env, chatId, `${plainPrefix}${plainParts[i] ?? ''}`);
    }
  }
}

export async function deliverRunReply(env: Env, chatId: number, run: CursorRun): Promise<void> {
  if (!isTerminalRunStatus(run.status)) {
    await sendMessage(
      env,
      chatId,
      [
        'My student, I am still on the mat with your request, the run has not finished yet.',
        `Try <code>${MASTER_SPLINTER_CMD} status</code> in a minute — I will post the answer when Cursor finishes.`,
      ].join('\n\n'),
      { parseMode: 'HTML' },
    );
    return;
  }

  if (run.status !== 'FINISHED') {
    const body = markdownToTelegramHtml(formatRunForTelegram(run));
    try {
      await sendMessage(
        env,
        chatId,
        `<i>${escapeHtml(run.status)}</i>\n\n${body}`,
        { parseMode: 'HTML' },
      );
    } catch {
      await sendMessage(env, chatId, formatRunForTelegram(run));
    }
    return;
  }

  await sendSplinterReply(env, chatId, formatRunForTelegram(run));
}
