import type { BrowserKey } from './browsers';
import { browserLabel } from './browsers';
import type { DeviceKey } from './devices';
import { deviceDisplayLabel, TRELLO_DEVICES } from './devices';
import type { Env, ReportType } from './types';
import { REPORT_TYPE_LABELS } from './types';

const TRELLO_API = 'https://api.trello.com/1';

const DEFAULT_CUSTOM_FIELD_DEVICE = '69130d9c54d5911255a8d456';
const DEFAULT_CUSTOM_FIELD_ERC = '69130fb70d665e3c6726a906';

function trelloParams(env: Env): URLSearchParams {
  return new URLSearchParams({
    key: env.TRELLO_API_KEY,
    token: env.TRELLO_TOKEN,
  });
}

function deviceFieldId(env: Env): string {
  return env.TRELLO_CUSTOM_FIELD_DEVICE ?? DEFAULT_CUSTOM_FIELD_DEVICE;
}

function ercFieldId(env: Env): string {
  return env.TRELLO_CUSTOM_FIELD_ERC ?? DEFAULT_CUSTOM_FIELD_ERC;
}

function labelIdsForReport(env: Env, type: ReportType): string[] {
  const ids: string[] = [];
  if (type === 'bug' && env.TRELLO_LABEL_BUG) ids.push(env.TRELLO_LABEL_BUG);
  if (type === 'wishlist' && env.TRELLO_LABEL_IDEA) ids.push(env.TRELLO_LABEL_IDEA);
  return ids;
}

export function buildCardName(
  type: ReportType,
  device: DeviceKey,
  title: string,
  browser?: BrowserKey,
): string {
  const prefix = type === 'bug' ? 'Bug' : 'Wishlist';
  const devicePart = deviceDisplayLabel(device, browser ? browserLabel(browser) : undefined);
  return `[${prefix}][${devicePart}] ${title}`;
}

export function buildCardDescription(input: {
  type: ReportType;
  device: DeviceKey;
  browser?: BrowserKey;
  title: string;
  details: string;
  ercAddress: string;
  reporterUsername?: string;
  reporterId: number;
  chatId: number;
}): string {
  const { type, device, browser, title, details, ercAddress, reporterUsername, reporterId, chatId } =
    input;
  const reporter = reporterUsername ? `@${reporterUsername}` : `user:${reporterId}`;
  const deviceLine = deviceDisplayLabel(device, browser ? browserLabel(browser) : undefined);

  const lines = [
    `**Reporter:** ${reporter} (${reporterId})`,
    `**Type:** ${REPORT_TYPE_LABELS[type]}`,
    `**Device:** ${deviceLine}`,
  ];
  if (browser) {
    lines.push(`**Browser:** ${browserLabel(browser)}`);
  }
  lines.push(
    `**ERC ADDRESS:** ${ercAddress}`,
    `**Channel:** QA (${chatId})`,
    '',
    '### Summary',
    title,
    '',
    '### Details',
    details,
  );
  return lines.join('\n');
}

async function setListCustomField(
  env: Env,
  cardId: string,
  customFieldId: string,
  optionId: string,
): Promise<void> {
  const params = trelloParams(env);
  const response = await fetch(
    `${TRELLO_API}/cards/${cardId}/customField/${customFieldId}/item?${params.toString()}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idValue: optionId }),
    },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Trello setListCustomField failed (${response.status}): ${body}`);
  }
}

async function setTextCustomField(
  env: Env,
  cardId: string,
  customFieldId: string,
  text: string,
): Promise<void> {
  const params = trelloParams(env);
  const response = await fetch(
    `${TRELLO_API}/cards/${cardId}/customField/${customFieldId}/item?${params.toString()}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: { text } }),
    },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Trello setTextCustomField failed (${response.status}): ${body}`);
  }
}

export async function setCardCustomFields(
  env: Env,
  cardId: string,
  input: { device: DeviceKey; ercAddress: string },
): Promise<void> {
  const deviceOption = TRELLO_DEVICES[input.device];
  await setListCustomField(env, cardId, deviceFieldId(env), deviceOption.optionId);
  await setTextCustomField(env, cardId, ercFieldId(env), input.ercAddress);
}

export async function createCard(
  env: Env,
  input: {
    type: ReportType;
    device: DeviceKey;
    browser?: BrowserKey;
    title: string;
    details: string;
    ercAddress: string;
    reporterUsername?: string;
    reporterId: number;
    chatId: number;
  },
): Promise<{ id: string; shortUrl: string; name: string }> {
  const params = trelloParams(env);
  params.set('idList', env.TRELLO_INBOX_LIST_ID);
  params.set('name', buildCardName(input.type, input.device, input.title, input.browser));
  params.set('desc', buildCardDescription(input));

  const labels = labelIdsForReport(env, input.type);
  for (const labelId of labels) {
    params.append('idLabels', labelId);
  }

  const response = await fetch(`${TRELLO_API}/cards?${params.toString()}`, {
    method: 'POST',
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Trello createCard failed (${response.status}): ${body}`);
  }

  const card = (await response.json()) as { id: string; shortUrl: string; name: string };

  await setCardCustomFields(env, card.id, {
    device: input.device,
    ercAddress: input.ercAddress,
  });

  return card;
}

export async function addAttachment(
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
    const body = await response.text();
    throw new Error(`Trello addAttachment failed (${response.status}): ${body}`);
  }
}
