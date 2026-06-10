import { isAdminUser, normalizeCommand, sendMessage } from '../telegram';
import { escapeHtml } from '../telegram-format';
import { getProductDefinition, listProductSlugs, phaseGoal } from './catalog';
import { productFeedbackKeyboard, announceProductPhase } from './announce';
import { productListLabel } from './lists';
import {
  clearActiveProductCampaign,
  loadActiveProductCampaign,
  setProductPhase,
  startProductCampaign,
} from './store';
import type { ProductPhase } from './types';
import type { Env, TelegramMessage } from '../types';

const PRODUCT_CMD = '/product';

function parsePhase(raw: string | undefined): ProductPhase | null {
  const n = Number(raw);
  if (n === 1 || n === 2 || n === 3) return n;
  return null;
}

function productHelpText(slugs: string[]): string {
  return [
    '<b>Product QA</b>',
    '',
    '<b>Admin</b> (you start the build review first):',
    `<code>${PRODUCT_CMD} marketplace</code> · open Marketplace Phase 1`,
    `<code>${PRODUCT_CMD} phase 2</code> · advance active campaign`,
    `<code>${PRODUCT_CMD} status</code> · current campaign and queue`,
    `<code>${PRODUCT_CMD} close</code> · end active campaign`,
    '',
    '<b>Reporters</b> (after admin opens a build):',
    `<code>${PRODUCT_CMD}</code> · submit feedback on the active product`,
    '',
    `Known products: ${slugs.map((s) => `<code>${escapeHtml(s)}</code>`).join(', ')}`,
  ].join('\n');
}

async function handleProductStatus(env: Env, chatId: number): Promise<void> {
  const active = await loadActiveProductCampaign(env);
  if (!active) {
    await sendMessage(env, chatId, 'No product QA campaign is open. Admin starts one first.');
    return;
  }

  const def = getProductDefinition(active.slug);
  const goal = def ? phaseGoal(def, active.phase) : undefined;
  const lines = [
    `<b>Active:</b> ${escapeHtml(active.label)}`,
    `<b>Phase:</b> ${active.phase}${goal ? ` · ${escapeHtml(goal.title)}` : ''}`,
    `<b>Queue:</b> ${escapeHtml(productListLabel(env, active.phase))}`,
    `<b>Opened:</b> ${escapeHtml(active.startedAt)}`,
  ];
  if (goal?.goal) {
    lines.push('', escapeHtml(goal.goal));
  }
  await sendMessage(env, chatId, lines.join('\n'), { parseMode: 'HTML' });
}

async function adminStartProduct(
  env: Env,
  chatId: number,
  slug: string,
  userId: number,
  username?: string,
): Promise<void> {
  const def = getProductDefinition(slug);
  if (!def) {
    await sendMessage(
      env,
      chatId,
      `Unknown product <code>${escapeHtml(slug)}</code>. Known: ${listProductSlugs().map((s) => `<code>${s}</code>`).join(', ')}`,
      { parseMode: 'HTML' },
    );
    return;
  }

  const existing = await loadActiveProductCampaign(env);
  if (existing && existing.slug !== slug) {
    await sendMessage(
      env,
      chatId,
      `Close <b>${escapeHtml(existing.label)}</b> first with <code>${PRODUCT_CMD} close</code>.`,
      { parseMode: 'HTML' },
    );
    return;
  }

  if (existing?.slug === slug) {
    await handleProductStatus(env, chatId);
    return;
  }

  const campaign = await startProductCampaign(env, {
    slug: def.slug,
    label: def.label,
    phase: 1,
    startedBy: userId,
    startedByUsername: username,
  });

  await announceProductPhase(env, campaign);

  const goal = phaseGoal(def, 1);
  await sendMessage(
    env,
    chatId,
    [
      `<b>${escapeHtml(def.label)}</b> is live at <b>Phase 1</b>.`,
      goal ? escapeHtml(goal.goal) : '',
      '',
      `Queue: ${escapeHtml(productListLabel(env, 1))}`,
      'Reporters can now use /product.',
    ]
      .filter(Boolean)
      .join('\n'),
    { parseMode: 'HTML' },
  );
}

async function adminSetPhase(env: Env, chatId: number, phase: ProductPhase): Promise<void> {
  const active = await loadActiveProductCampaign(env);
  if (!active) {
    await sendMessage(env, chatId, `No active campaign. Start one with <code>${PRODUCT_CMD} marketplace</code>.`, {
      parseMode: 'HTML',
    });
    return;
  }

  const updated = await setProductPhase(env, phase);
  if (!updated) return;

  await announceProductPhase(env, updated);

  const def = getProductDefinition(updated.slug);
  const goal = def ? phaseGoal(def, phase) : undefined;
  await sendMessage(
    env,
    chatId,
    [
      `<b>${escapeHtml(updated.label)}</b> advanced to <b>Phase ${phase}</b>.`,
      goal ? escapeHtml(goal.goal) : '',
      '',
      `Queue: ${escapeHtml(productListLabel(env, phase))}`,
    ]
      .filter(Boolean)
      .join('\n'),
    { parseMode: 'HTML' },
  );
}

async function openProductFeedback(env: Env, chatId: number, slug?: string): Promise<void> {
  const active = await loadActiveProductCampaign(env);
  if (!active) {
    await sendMessage(
      env,
      chatId,
      'No product build is open for feedback yet. Wait for the admin to launch one.',
    );
    return;
  }

  if (slug && slug !== active.slug) {
    await sendMessage(
      env,
      chatId,
      `Only <b>${escapeHtml(active.label)}</b> is open right now. Use <code>${PRODUCT_CMD}</code>.`,
      { parseMode: 'HTML' },
    );
    return;
  }

  const def = getProductDefinition(active.slug);
  const goal = def ? phaseGoal(def, active.phase) : undefined;
  const intro = [
    `${active.label} feedback · Phase ${active.phase}`,
    goal?.title ? `Focus: ${goal.title}` : '',
    'Open the form:',
  ]
    .filter(Boolean)
    .join('\n');

  await sendMessage(env, chatId, intro, {
    replyMarkup: productFeedbackKeyboard(env, active.label, active.slug),
  });
}

export async function handleProductCommand(env: Env, message: TelegramMessage): Promise<boolean> {
  const text = message.text?.trim() ?? '';
  const command = normalizeCommand(text);
  if (command !== PRODUCT_CMD && !text.toLowerCase().startsWith(`${PRODUCT_CMD} `)) {
    return false;
  }

  const chatId = message.chat.id;
  const userId = message.from?.id;
  if (!userId) return true;

  const rest = text.slice(PRODUCT_CMD.length).trim();
  const parts = rest.split(/\s+/).filter(Boolean);
  const sub = parts[0]?.toLowerCase() ?? '';
  const isAdmin = await isAdminUser(env, userId, message.from?.username);

  if (!rest || sub === 'help') {
    await sendMessage(env, chatId, productHelpText(listProductSlugs()), { parseMode: 'HTML' });
    return true;
  }

  if (sub === 'status') {
    await handleProductStatus(env, chatId);
    return true;
  }

  if (isAdmin && sub === 'close') {
    const active = await loadActiveProductCampaign(env);
    if (!active) {
      await sendMessage(env, chatId, 'Nothing to close.');
      return true;
    }
    await clearActiveProductCampaign(env);
    await sendMessage(env, chatId, `${active.label} product QA closed.`);
    return true;
  }

  if (isAdmin && sub === 'phase') {
    const phase = parsePhase(parts[1]);
    if (!phase) {
      await sendMessage(env, chatId, `Usage: <code>${PRODUCT_CMD} phase 1|2|3</code>`, { parseMode: 'HTML' });
      return true;
    }
    await adminSetPhase(env, chatId, phase);
    return true;
  }

  if (isAdmin && getProductDefinition(sub)) {
    await adminStartProduct(env, chatId, sub, userId, message.from?.username);
    return true;
  }

  if (getProductDefinition(sub)) {
    await openProductFeedback(env, chatId, sub);
    return true;
  }

  if (sub === 'feedback' || !sub) {
    await openProductFeedback(env, chatId);
    return true;
  }

  // Bare /product for reporters
  if (!isAdmin) {
    await openProductFeedback(env, chatId);
    return true;
  }

  await sendMessage(env, chatId, productHelpText(listProductSlugs()), { parseMode: 'HTML' });
  return true;
}
