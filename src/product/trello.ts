import { productAreaLabel } from './areas';
import type { Env } from '../types';

const TRELLO_API = 'https://api.trello.com/1';

function trelloParams(env: Env): URLSearchParams {
  return new URLSearchParams({
    key: env.TRELLO_API_KEY,
    token: env.TRELLO_TOKEN,
  });
}

function productListId(env: Env): string {
  return env.TRELLO_PRODUCT_LIST_ID?.trim() || env.TRELLO_INBOX_LIST_ID;
}

export async function createProductHubCard(
  env: Env,
  displayName: string,
  slug: string,
  openedBy: number,
): Promise<{ cardId: string; shortUrl: string; checklistId: string; name: string }> {
  const params = trelloParams(env);
  params.set('idList', productListId(env));
  params.set('name', `[Product][${displayName}] Feedback hub`);
  params.set(
    'desc',
    [
      `**Product feedback:** ${displayName}`,
      `**Slug:** \`${slug}\``,
      `**Opened by:** ${openedBy}`,
      '',
      'All reporter submissions land on this card as checklist items + comments.',
      'Close the round with `/product close` when feedback collection ends.',
    ].join('\n'),
  );

  const cardRes = await fetch(`${TRELLO_API}/cards?${params.toString()}`, { method: 'POST' });
  if (!cardRes.ok) {
    throw new Error(`Trello createProductHubCard failed (${cardRes.status}): ${await cardRes.text()}`);
  }
  const card = (await cardRes.json()) as { id: string; shortUrl: string; name: string };

  const checklistParams = trelloParams(env);
  checklistParams.set('idCard', card.id);
  checklistParams.set('name', 'Feedback items');

  const checklistRes = await fetch(`${TRELLO_API}/checklists?${checklistParams.toString()}`, {
    method: 'POST',
  });
  if (!checklistRes.ok) {
    throw new Error(`Trello create checklist failed (${checklistRes.status}): ${await checklistRes.text()}`);
  }
  const checklist = (await checklistRes.json()) as { id: string };

  return {
    cardId: card.id,
    shortUrl: card.shortUrl,
    checklistId: checklist.id,
    name: card.name,
  };
}

export interface ProductFeedbackInput {
  area: string;
  title: string;
  details: string;
  device?: string;
  reporterUsername?: string;
  reporterId: number;
  reporterFirstName?: string;
  itemNumber: number;
}

export async function appendProductFeedback(
  env: Env,
  cardId: string,
  checklistId: string,
  input: ProductFeedbackInput,
): Promise<{ checkItemId: string }> {
  const reporter = input.reporterUsername
    ? `@${input.reporterUsername}`
    : input.reporterFirstName ?? `user:${input.reporterId}`;
  const area = productAreaLabel(input.area);
  const checkName = `#${input.itemNumber} [${area}] ${input.title} — ${reporter}`.slice(0, 16384);

  const itemParams = trelloParams(env);
  itemParams.set('name', checkName);
  itemParams.set('pos', 'bottom');

  const itemRes = await fetch(
    `${TRELLO_API}/checklists/${checklistId}/checkItems?${itemParams.toString()}`,
    { method: 'POST' },
  );
  if (!itemRes.ok) {
    throw new Error(`Trello checkItem failed (${itemRes.status}): ${await itemRes.text()}`);
  }
  const item = (await itemRes.json()) as { id: string };

  const commentLines = [
    `**#${input.itemNumber} · ${area}**`,
    `**Reporter:** ${reporter} (${input.reporterId})`,
  ];
  if (input.device) commentLines.push(`**Device:** ${input.device}`);
  commentLines.push('', '### Summary', input.title, '', '### Details', input.details);

  const commentParams = trelloParams(env);
  commentParams.set('text', commentLines.join('\n'));

  const commentRes = await fetch(
    `${TRELLO_API}/cards/${cardId}/actions/comments?${commentParams.toString()}`,
    { method: 'POST' },
  );
  if (!commentRes.ok) {
    throw new Error(`Trello comment failed (${commentRes.status}): ${await commentRes.text()}`);
  }

  return { checkItemId: item.id };
}

export async function addProductAttachment(
  env: Env,
  cardId: string,
  fileName: string,
  data: ArrayBuffer,
): Promise<void> {
  const params = trelloParams(env);
  const form = new FormData();
  form.append('file', new Blob([data]), fileName);
  form.append('name', fileName);

  const response = await fetch(`${TRELLO_API}/cards/${cardId}/attachments?${params.toString()}`, {
    method: 'POST',
    body: form,
  });
  if (!response.ok) {
    throw new Error(`Trello addProductAttachment failed (${response.status}): ${await response.text()}`);
  }
}
