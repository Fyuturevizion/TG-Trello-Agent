import type { BrowserKey } from '../browsers';
import { browserLabel } from '../browsers';
import type { DeviceKey } from '../devices';
import { deviceDisplayLabel } from '../devices';
import { resolveProductListId } from './lists';
import { PRODUCT_FEATURE_AREA_LABELS } from './types';
import type { ProductFeatureArea, ProductPhase } from './types';
import { phaseGoal, getProductDefinition } from './catalog';
import { setCardCustomFields } from '../trello';
import type { Env } from '../types';

const TRELLO_API = 'https://api.trello.com/1';

function trelloParams(env: Env): URLSearchParams {
  return new URLSearchParams({
    key: env.TRELLO_API_KEY,
    token: env.TRELLO_TOKEN,
  });
}

export function buildProductCardName(
  productLabel: string,
  phase: ProductPhase,
  featureArea: ProductFeatureArea,
  device: DeviceKey,
  title: string,
  browser?: BrowserKey,
): string {
  const area = PRODUCT_FEATURE_AREA_LABELS[featureArea];
  const devicePart = deviceDisplayLabel(device, browser ? browserLabel(browser) : undefined);
  return `[Product][${productLabel}][P${phase}][${area}][${devicePart}] ${title}`;
}

export function buildProductCardDescription(input: {
  productSlug: string;
  productLabel: string;
  phase: ProductPhase;
  featureArea: ProductFeatureArea;
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
  const def = getProductDefinition(input.productSlug);
  const goal = def ? phaseGoal(def, input.phase) : undefined;
  const reporter = input.reporterUsername ? `@${input.reporterUsername}` : `user:${input.reporterId}`;
  const deviceLine = deviceDisplayLabel(
    input.device,
    input.browser ? browserLabel(input.browser) : undefined,
  );

  const lines = [
    `**Reporter:** ${reporter} (${input.reporterId})`,
    `**Product:** ${input.productLabel}`,
    `**Phase:** ${input.phase}${goal ? ` — ${goal.title}` : ''}`,
    `**Feature area:** ${PRODUCT_FEATURE_AREA_LABELS[input.featureArea]}`,
    `**Device:** ${deviceLine}`,
  ];
  if (input.browser) lines.push(`**Browser:** ${browserLabel(input.browser)}`);
  if (input.appVersion) lines.push(`**App version:** ${input.appVersion}`);
  if (input.device === 'native_app') {
    lines.push('**Scope:** Both native apps (iOS and Android)');
  }
  lines.push(
    `**ERC ADDRESS:** ${input.ercAddress}`,
    `**Channel:** QA (${input.chatId})`,
  );
  if (goal?.goal) {
    lines.push('', '### Phase goal', goal.goal);
  }
  lines.push('', '### Summary', input.title, '', '### Details', input.details);
  return lines.join('\n');
}

export async function createProductCard(
  env: Env,
  input: {
    productSlug: string;
    productLabel: string;
    phase: ProductPhase;
    featureArea: ProductFeatureArea;
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
): Promise<{ id: string; shortUrl: string; name: string; listId: string }> {
  const listId = resolveProductListId(env, input.phase);
  const params = trelloParams(env);
  params.set('idList', listId);
  params.set(
    'name',
    buildProductCardName(
      input.productLabel,
      input.phase,
      input.featureArea,
      input.device,
      input.title,
      input.browser,
    ),
  );
  params.set('desc', buildProductCardDescription(input));

  if (env.TRELLO_LABEL_PRODUCT?.trim()) {
    params.append('idLabels', env.TRELLO_LABEL_PRODUCT.trim());
  }

  const response = await fetch(`${TRELLO_API}/cards?${params.toString()}`, { method: 'POST' });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Trello createProductCard failed (${response.status}): ${body}`);
  }

  const card = (await response.json()) as { id: string; shortUrl: string; name: string };
  await setCardCustomFields(env, card.id, {
    device: input.device,
    ercAddress: input.ercAddress,
  });

  return { ...card, listId };
}
