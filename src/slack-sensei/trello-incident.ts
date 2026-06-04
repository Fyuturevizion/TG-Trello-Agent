import type { Env } from '../types';
import type { ParsedSentryIssue } from './sentry-parse';

const TRELLO_API = 'https://api.trello.com/1';

function trelloParams(env: Env): URLSearchParams {
  return new URLSearchParams({
    key: env.TRELLO_API_KEY,
    token: env.TRELLO_TOKEN,
  });
}

function senseiListId(env: Env): string {
  return (
    env.TRELLO_SENSEI_LIST_ID?.trim() ||
    env.TRELLO_INBOX_LIST_ID?.trim() ||
    ''
  );
}

export async function createSenseiTrelloCard(
  env: Env,
  issue: ParsedSentryIssue,
  slackThreadUrl?: string,
): Promise<{ id: string; shortUrl: string; name: string }> {
  const listId = senseiListId(env);
  if (!listId) throw new Error('TRELLO_SENSEI_LIST_ID or TRELLO_INBOX_LIST_ID is not set');

  const name = `[Sentry] ${issue.title}`.slice(0, 160);
  const lines = [
    '**Source:** Sentry (Slack Sensei)',
    `**Issue ID:** ${issue.issueId}`,
    issue.level ? `**Level:** ${issue.level}` : null,
    issue.project ? `**Project:** ${issue.project}` : null,
    issue.culprit ? `**Culprit:** ${issue.culprit}` : null,
    issue.permalink ? `**Sentry:** ${issue.permalink}` : null,
    slackThreadUrl ? `**Slack thread:** ${slackThreadUrl}` : null,
    '',
    '### Stack / message',
    issue.stackSnippet ?? '(no snippet in payload)',
    '',
    '_Card opened automatically. Agent + PR workflow coming in Phase 2b._',
  ].filter(Boolean);

  const params = trelloParams(env);
  params.set('idList', listId);
  params.set('name', name);
  params.set('desc', lines.join('\n'));

  const response = await fetch(`${TRELLO_API}/cards?${params.toString()}`, { method: 'POST' });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Trello createSenseiTrelloCard failed (${response.status}): ${body}`);
  }

  return (await response.json()) as { id: string; shortUrl: string; name: string };
}
