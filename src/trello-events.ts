import { getCardReporter } from './card-reporter';
import { announceTrelloEvent, notifyReporterDm } from './channel';
import {
  escapeHtml,
  formatBoardLine,
  formatCardUpdateMessage,
  formatListLine,
  formatReporterMention,
  type CardUpdateMessage,
} from './telegram-format';
import type { Env } from './types';

interface TrelloWebhookPayload {
  action?: {
    type?: string;
    data?: {
      card?: { id?: string; name?: string; shortUrl?: string; closed?: boolean };
      list?: { id?: string; name?: string };
      listBefore?: { id?: string; name?: string };
      listAfter?: { id?: string; name?: string };
      board?: { id?: string; name?: string };
      boardSource?: { id?: string; name?: string };
      old?: { closed?: boolean };
    };
    memberCreator?: { fullName?: string; username?: string };
  };
}

const REVIEW_LIST_NAMES = new Set(['pwa review', 'mobile - review']);

function cardTitle(payload: TrelloWebhookPayload): string {
  return payload.action?.data?.card?.name ?? 'A card';
}

function cardShortUrl(payload: TrelloWebhookPayload): string | undefined {
  return payload.action?.data?.card?.shortUrl;
}

function updatedBy(payload: TrelloWebhookPayload): string {
  const c = payload.action?.memberCreator;
  if (c?.username) return `@${escapeHtml(c.username)}`;
  return escapeHtml(c?.fullName ?? 'Someone');
}

function inboxListId(env: Env): string | undefined {
  return env.TRELLO_INBOX_LIST_ID?.trim() || undefined;
}

function reviewListIds(env: Env): Set<string> {
  const raw = env.TRELLO_REVIEW_LIST_IDS?.trim();
  if (!raw) return new Set();
  return new Set(raw.split(',').map((id) => id.trim()).filter(Boolean));
}

function archiveListIds(env: Env): Set<string> {
  const raw = env.TRELLO_ARCHIVE_LIST_IDS?.trim();
  if (!raw) return new Set();
  return new Set(raw.split(',').map((id) => id.trim()).filter(Boolean));
}

function isReviewList(
  env: Env,
  listAfter?: { id?: string; name?: string },
): listAfter is { id?: string; name: string } {
  if (!listAfter?.name) return false;
  if (listAfter.id && reviewListIds(env).has(listAfter.id)) return true;
  return REVIEW_LIST_NAMES.has(listAfter.name.trim().toLowerCase());
}

async function notifyCardUpdate(
  env: Env,
  cardId: string | undefined,
  message: Omit<CardUpdateMessage, 'createdBy'>,
  dmHeadline?: string,
): Promise<void> {
  const reporter = cardId ? await getCardReporter(env, cardId) : null;
  const createdBy = reporter ? formatReporterMention(reporter) : undefined;
  const lines = formatCardUpdateMessage({ ...message, createdBy });
  await announceTrelloEvent(env, lines);

  if (reporter && dmHeadline) {
    const dmLines = formatCardUpdateMessage({
      headline: dmHeadline,
      title: message.title,
      boardLine: message.boardLine,
      listLine: message.listLine,
      shortUrl: message.shortUrl,
      createdBy,
    });
    await notifyReporterDm(env, reporter.reporterId, dmLines.join('\n'));
  }
}

async function notifyReporterTestRequest(
  env: Env,
  cardId: string | undefined,
  input: {
    title: string;
    shortUrl?: string;
    board?: { name?: string };
    listAfter?: { id?: string; name?: string };
    listBefore?: { id?: string; name?: string };
    listName: string;
  },
): Promise<void> {
  const reporter = cardId ? await getCardReporter(env, cardId) : null;
  if (!reporter) return;

  const dmLines = formatCardUpdateMessage({
    headline: 'Please test this update',
    title: input.title,
    subtitle: `Your report was moved to <b>${escapeHtml(input.listName)}</b>. Please test the update and report back in the QA channel if anything still looks wrong.`,
    boardLine: formatBoardLine(env, input.board),
    listLine: formatListLine(input.listAfter, input.listBefore),
    shortUrl: input.shortUrl,
    createdBy: formatReporterMention(reporter),
  });
  await notifyReporterDm(env, reporter.reporterId, dmLines.join('\n'));
}

export async function handleTrelloWebhook(env: Env, payload: TrelloWebhookPayload): Promise<void> {
  const action = payload.action;
  if (!action?.type) return;

  const type = action.type;
  const data = action.data;
  const cardId = data?.card?.id;
  const title = cardTitle(payload);
  const shortUrl = cardShortUrl(payload);
  const editor = updatedBy(payload);

  if (type === 'updateCard' && data?.card?.closed === true && data.old?.closed === false) {
    return;
  }

  if (type === 'moveCardToBoard' && data?.board) {
    await notifyCardUpdate(env, cardId, {
      headline: 'Moved to another board',
      title,
      boardLine: formatBoardLine(env, data.board, data.boardSource),
      listLine: formatListLine(data.listAfter, data.listBefore),
      shortUrl,
      updatedBy: editor,
    });
    return;
  }

  if (
    (type === 'updateCard' || type === 'moveCardFromBoard' || type === 'moveCardToBoard') &&
    data?.listAfter
  ) {
    const doneId = env.TRELLO_DONE_LIST_ID?.trim();
    const isDone = doneId && data.listAfter.id === doneId;
    const isArchive = data.listAfter.id && archiveListIds(env).has(data.listAfter.id);
    const leftInbox =
      data.listBefore?.id && inboxListId(env) && data.listBefore.id === inboxListId(env);

    if (isArchive) {
      return;
    }

    if (isReviewList(env, data.listAfter)) {
      await notifyReporterTestRequest(env, cardId, {
        title,
        shortUrl,
        board: data.board,
        listAfter: data.listAfter,
        listBefore: data.listBefore,
        listName: data.listAfter.name,
      });
      return;
    }

    if (isDone) {
      await notifyCardUpdate(
        env,
        cardId,
        {
          headline: 'Card completed (DONE)',
          title,
          boardLine: formatBoardLine(env, data.board),
          listLine: formatListLine(data.listAfter, data.listBefore),
          shortUrl,
          updatedBy: editor,
        },
        'Your triage card is completed (DONE)',
      );
      return;
    }

    await notifyCardUpdate(env, cardId, {
      headline: leftInbox ? 'Left INBOX' : 'List updated',
      title,
      boardLine: formatBoardLine(env, data.board),
      listLine: formatListLine(data.listAfter, data.listBefore),
      shortUrl,
      updatedBy: editor,
    });
  }
}
