import { getCardReporter } from './card-reporter';
import { announceTrelloEvent, notifyReporterDm } from './channel';
import { escapeHtml, formatTrelloCardLink } from './telegram-format';
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
      member?: { fullName?: string; username?: string };
    };
    memberCreator?: { fullName?: string; username?: string };
  };
}

function cardLabel(payload: TrelloWebhookPayload): string {
  const card = payload.action?.data?.card;
  if (!card?.name) return 'A card';
  return formatTrelloCardLink(card.name, card.shortUrl);
}

function cardDmText(intro: string, name?: string, shortUrl?: string): string {
  return `${intro}\n${formatTrelloCardLink(name ?? 'Card', shortUrl)}`;
}

function creatorLabel(payload: TrelloWebhookPayload): string {
  const c = payload.action?.memberCreator;
  if (c?.username) return `@${escapeHtml(c.username)}`;
  return escapeHtml(c?.fullName ?? 'Someone');
}

function inboxListId(env: Env): string | undefined {
  return env.TRELLO_INBOX_LIST_ID?.trim() || undefined;
}

function devBoardId(env: Env): string | undefined {
  return env.TRELLO_DEV_BOARD_ID?.trim() || undefined;
}

function archiveListIds(env: Env): Set<string> {
  const raw = env.TRELLO_ARCHIVE_LIST_IDS?.trim();
  if (!raw) return new Set();
  return new Set(raw.split(',').map((id) => id.trim()).filter(Boolean));
}

function isDevBoard(env: Env, boardId?: string, boardName?: string): boolean {
  const devId = devBoardId(env);
  if (devId && boardId === devId) return true;
  if (boardName?.toLowerCase().includes('development')) return true;
  return false;
}

async function notifyReporter(
  env: Env,
  cardId: string | undefined,
  channelLines: string[],
  dmText?: string,
): Promise<void> {
  const reporter = cardId ? await getCardReporter(env, cardId) : null;
  await announceTrelloEvent(env, channelLines, reporter);
  if (reporter && dmText) {
    await notifyReporterDm(env, reporter.reporterId, dmText);
  }
}

export async function handleTrelloWebhook(env: Env, payload: TrelloWebhookPayload): Promise<void> {
  const action = payload.action;
  if (!action?.type) return;

  const type = action.type;
  const data = action.data;
  const cardId = data?.card?.id;
  const card = cardLabel(payload);
  const creator = creatorLabel(payload);

  if (type === 'addMemberToCard' && data?.member) {
    const assignee = escapeHtml(data.member.fullName ?? data.member.username ?? 'member');
    const devBoard = isDevBoard(env, data.board?.id, data.board?.name);
    const lines = [
      devBoard ? '<b>Assigned on Development board</b>' : '<b>Card assigned</b>',
      '',
      assignee,
      '→',
      card,
      '',
      `Updated by ${creator}`,
    ];
    await notifyReporter(env, cardId, lines);
    return;
  }

  if (type === 'updateCard' && data?.card?.closed === true && data.old?.closed === false) {
    await notifyReporter(
      env,
      cardId,
      ['<b>Card archived</b>', '', card, '', `Archived by ${creator}`],
      cardDmText('Your triage card was archived:', data.card.name, data.card.shortUrl),
    );
    return;
  }

  if (type === 'moveCardToBoard' && data?.board) {
    const destBoard = escapeHtml(data.board.name ?? 'another board');
    const sourceBoard = data.boardSource?.name
      ? escapeHtml(data.boardSource.name)
      : 'Support/Triage';
    const fromInbox =
      data.listBefore?.id && inboxListId(env) && data.listBefore.id === inboxListId(env);

    const lines = [
      isDevBoard(env, data.board.id, data.board.name)
        ? '<b>Moved to Development board</b>'
        : '<b>Moved to another board</b>',
      '',
      `${sourceBoard} → ${destBoard}`,
      '',
      card,
      '',
      `Moved by ${creator}`,
    ];
    if (fromInbox) {
      lines.splice(2, 0, '<i>Left INBOX — card picked up for development</i>');
    }
    await notifyReporter(env, cardId, lines);
    return;
  }

  if (
    (type === 'updateCard' || type === 'moveCardFromBoard' || type === 'moveCardToBoard') &&
    data?.listAfter
  ) {
    const listName = escapeHtml(data.listAfter.name ?? 'another list');
    const before = data.listBefore?.name ? escapeHtml(data.listBefore.name) : undefined;
    const doneId = env.TRELLO_DONE_LIST_ID?.trim();
    const isDone = doneId && data.listAfter.id === doneId;
    const leftInbox =
      data.listBefore?.id && inboxListId(env) && data.listBefore.id === inboxListId(env);
    const isArchive = data.listAfter.id && archiveListIds(env).has(data.listAfter.id);

    if (isDone || isArchive) {
      const status = isDone ? 'completed (DONE)' : 'archived';
      await notifyReporter(
        env,
        cardId,
        [`<b>Card ${status}</b>`, '', card, '', `Updated by ${creator}`],
        cardDmText(`Your triage card is ${status}:`, data.card?.name, data.card?.shortUrl),
      );
      return;
    }

    const moveLine = before ? `Moved: ${before} → ${listName}` : `Moved to ${listName}`;
    const lines = ['<b>List updated</b>', '', moveLine, '', card, '', `Updated by ${creator}`];
    if (leftInbox) {
      lines.splice(2, 0, '<i>Left INBOX</i>');
    }
    await notifyReporter(env, cardId, lines);
  }
}
