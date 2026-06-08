import type { BrowserKey } from './browsers';
import { browserLabel } from './browsers';
import type { DeviceKey } from './devices';
import { deviceDisplayLabel, trelloDeviceOptionId } from './devices';
import { ensureNativeAppDeviceOptionId } from './trello-device-options';
import type { ProductDefinition } from './products';
import {
  PRODUCT_FEEDBACK_TYPE_LABELS,
  buildProductParentCardDescription,
  featureAreaLabel,
} from './products';
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
  appVersion?: string;
  title: string;
  details: string;
  ercAddress: string;
  reporterUsername?: string;
  reporterId: number;
  chatId: number;
}): string {
  const { type, device, browser, appVersion, title, details, ercAddress, reporterUsername, reporterId, chatId } =
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
  if (appVersion) {
    lines.push(`**App version:** ${appVersion}`);
  }
  if (device === 'native_app') {
    lines.push('**Scope:** Both native apps (iOS and Android)');
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

async function resolveDeviceOptionId(env: Env, device: DeviceKey): Promise<string> {
  if (device === 'native_app') {
    return ensureNativeAppDeviceOptionId(env);
  }
  return trelloDeviceOptionId(env, device);
}

export async function setCardCustomFields(
  env: Env,
  cardId: string,
  input: { device: DeviceKey; ercAddress: string },
): Promise<void> {
  const deviceOptionId = await resolveDeviceOptionId(env, input.device);
  await setListCustomField(env, cardId, deviceFieldId(env), deviceOptionId);
  await setTextCustomField(env, cardId, ercFieldId(env), input.ercAddress);
}

export async function createCard(
  env: Env,
  input: {
    type: ReportType;
    device: DeviceKey;
    browser?: BrowserKey;
    appVersion?: string;
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

export async function createProductFeedbackCard(
  env: Env,
  definition: ProductDefinition,
): Promise<{ id: string; shortUrl: string; name: string }> {
  const params = trelloParams(env);
  params.set('idList', env.TRELLO_INBOX_LIST_ID);
  params.set('name', `[Product Feedback] ${definition.displayName}`);
  params.set('desc', buildProductParentCardDescription(definition));

  const response = await fetch(`${TRELLO_API}/cards?${params.toString()}`, {
    method: 'POST',
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Trello createProductFeedbackCard failed (${response.status}): ${body}`);
  }

  return (await response.json()) as { id: string; shortUrl: string; name: string };
}

const PRODUCT_CHECKLIST_NAME = 'Feedback';

export async function ensureProductChecklist(env: Env, cardId: string): Promise<string> {
  const params = trelloParams(env);
  const listRes = await fetch(`${TRELLO_API}/cards/${cardId}/checklists?${params.toString()}`);
  if (!listRes.ok) {
    const body = await listRes.text();
    throw new Error(`Trello list checklists failed (${listRes.status}): ${body}`);
  }

  const checklists = (await listRes.json()) as Array<{ id: string; name: string }>;
  const existing = checklists.find((c) => c.name === PRODUCT_CHECKLIST_NAME);
  if (existing) return existing.id;

  const createParams = trelloParams(env);
  createParams.set('idCard', cardId);
  createParams.set('name', PRODUCT_CHECKLIST_NAME);

  const createRes = await fetch(`${TRELLO_API}/checklists?${createParams.toString()}`, {
    method: 'POST',
  });
  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(`Trello create checklist failed (${createRes.status}): ${body}`);
  }

  const created = (await createRes.json()) as { id: string };
  return created.id;
}

export function buildProductChecklistItemName(input: {
  featureLabel: string;
  feedbackType: string;
  title: string;
}): string {
  const typeLabel = PRODUCT_FEEDBACK_TYPE_LABELS[input.feedbackType] ?? input.feedbackType;
  const shortType = typeLabel.split(' ')[0] ?? typeLabel;
  const name = `[${input.featureLabel}][${shortType}] ${input.title}`;
  return name.length > 160 ? `${name.slice(0, 157)}…` : name;
}

export function buildProductFeedbackComment(input: {
  definition: ProductDefinition;
  featureId: string;
  feedbackType: string;
  device: DeviceKey;
  browser?: BrowserKey;
  appVersion?: string;
  title: string;
  details: string;
  ercAddress: string;
  reporterUsername?: string;
  reporterId: number;
  submissionId: string;
}): string {
  const feature = featureAreaLabel(input.definition, input.featureId) ?? input.featureId;
  const reporter = input.reporterUsername ? `@${input.reporterUsername}` : `user:${input.reporterId}`;
  const deviceLine = deviceDisplayLabel(
    input.device,
    input.browser ? browserLabel(input.browser) : undefined,
  );
  const typeLabel = PRODUCT_FEEDBACK_TYPE_LABELS[input.feedbackType] ?? input.feedbackType;

  const lines = [
    `**Submission:** \`${input.submissionId}\``,
    `**Reporter:** ${reporter} (${input.reporterId})`,
    `**Feature:** ${feature}`,
    `**Feedback:** ${typeLabel}`,
    `**Device:** ${deviceLine}`,
  ];
  if (input.browser) lines.push(`**Browser:** ${browserLabel(input.browser)}`);
  if (input.appVersion) lines.push(`**App version:** ${input.appVersion}`);
  lines.push(
    `**ERC:** ${input.ercAddress}`,
    '',
    '### Summary',
    input.title,
    '',
    '### Details',
    input.details,
  );
  return lines.join('\n');
}

export async function addProductFeedbackItem(
  env: Env,
  input: {
    cardId: string;
    checklistId: string;
    checklistName: string;
    commentText: string;
  },
): Promise<{ checkItemId: string }> {
  const params = trelloParams(env);
  params.set('name', input.checklistName);
  params.set('pos', 'bottom');

  const itemRes = await fetch(
    `${TRELLO_API}/checklists/${input.checklistId}/checkItems?${params.toString()}`,
    { method: 'POST' },
  );
  if (!itemRes.ok) {
    const body = await itemRes.text();
    throw new Error(`Trello add checkItem failed (${itemRes.status}): ${body}`);
  }

  const item = (await itemRes.json()) as { id: string };

  const commentParams = trelloParams(env);
  commentParams.set('text', input.commentText);

  const commentRes = await fetch(
    `${TRELLO_API}/cards/${input.cardId}/actions/comments?${commentParams.toString()}`,
    { method: 'POST' },
  );
  if (!commentRes.ok) {
    const body = await commentRes.text();
    throw new Error(`Trello add comment failed (${commentRes.status}): ${body}`);
  }

  return { checkItemId: item.id };
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
