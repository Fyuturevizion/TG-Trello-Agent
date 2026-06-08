import { webAppUrl } from './channel';
import {
  getProductDefinition,
  getProductRecord,
  listKnownProductSlugs,
  normalizeProductSlug,
  saveProductRecord,
} from './products';
import { createProductFeedbackCard, ensureProductChecklist } from './trello';
import { isAdminUser, sendMessage } from './telegram';
import type { Env, TelegramMessage } from './types';

const BOT_USERNAME = 'WLTH_Triage_Bot';

function parseProductCommand(text: string): { slug?: string; action?: 'close' | 'status' } {
  const parts = text.trim().split(/\s+/);
  if (parts.length < 2) return {};

  const arg1 = parts[1]?.toLowerCase();
  if (arg1 === 'help' || arg1 === 'list') return { action: 'status' };

  const slug = normalizeProductSlug(arg1 ?? '');
  if (!slug) return {};

  const arg2 = parts[2]?.toLowerCase();
  if (arg2 === 'close' || arg2 === 'stop' || arg2 === 'end') {
    return { slug, action: 'close' };
  }

  return { slug };
}

function productStartAppUrl(slug: string): string {
  return `https://t.me/${BOT_USERNAME}?startapp=product_${slug}`;
}

function productWebAppUrl(env: Env, slug: string): string {
  return webAppUrl(env, { product: slug });
}

async function sendProductHelp(env: Env, chatId: number): Promise<void> {
  const known = listKnownProductSlugs();
  const active = (await Promise.all(known.map((slug) => getProductRecord(env, slug))))
    .filter((r): r is NonNullable<typeof r> => Boolean(r?.active))
    .map((r) => `• ${r.displayName} (\`/product ${r.slug}\`)`);

  const lines = [
    'Product feedback',
    '',
    'Admins launch a build first, then the dojo submits feedback to one Trello card.',
    '',
    '/product marketplace — open Marketplace feedback (when active)',
    '/product marketplace close — stop new submissions (admin)',
    '/product list — show active products',
    '',
    'Known products: ' + known.join(', '),
  ];

  if (active.length) {
    lines.push('', 'Active now:', ...active);
  } else {
    lines.push('', 'No product feedback session is active.');
  }

  await sendMessage(env, chatId, lines.join('\n'));
}

async function launchProduct(
  env: Env,
  chatId: number,
  userId: number,
  slug: string,
): Promise<void> {
  const definition = getProductDefinition(slug);
  if (!definition) {
    await sendMessage(
      env,
      chatId,
      `Unknown product "${slug}". Known: ${listKnownProductSlugs().join(', ')}`,
    );
    return;
  }

  const existing = await getProductRecord(env, slug);
  if (existing?.active) {
    await sendMessage(
      env,
      chatId,
      [
        `${definition.displayName} feedback is already open.`,
        '',
        `Trello: ${existing.shortUrl}`,
        '',
        `Testers: /product ${slug}`,
      ].join('\n'),
    );
    return;
  }

  if (existing && !existing.active) {
    await saveProductRecord(env, {
      ...existing,
      active: true,
      launchedAt: new Date().toISOString(),
      launchedBy: userId,
    });
    await sendMessage(
      env,
      chatId,
      [
        `${definition.displayName} feedback re-opened.`,
        '',
        `Parent card: ${existing.shortUrl}`,
        '',
        `Share with testers: /product ${slug}`,
      ].join('\n'),
    );
    return;
  }

  const card = await createProductFeedbackCard(env, definition);
  const checklistId = await ensureProductChecklist(env, card.id);

  const record = {
    slug,
    displayName: definition.displayName,
    cardId: card.id,
    shortUrl: card.shortUrl,
    checklistId,
    active: true,
    launchedAt: new Date().toISOString(),
    launchedBy: userId,
  };
  await saveProductRecord(env, record);

  await sendMessage(
    env,
    chatId,
    [
      `${definition.displayName} feedback is live.`,
      '',
      `Parent card: ${card.shortUrl}`,
      '',
      `Share with testers: /product ${slug}`,
      `Mini App: ${productStartAppUrl(slug)}`,
    ].join('\n'),
  );
}

async function closeProduct(env: Env, chatId: number, slug: string): Promise<void> {
  const definition = getProductDefinition(slug);
  if (!definition) {
    await sendMessage(env, chatId, `Unknown product "${slug}".`);
    return;
  }

  const record = await getProductRecord(env, slug);
  if (!record?.active) {
    await sendMessage(env, chatId, `${definition.displayName} feedback is not active.`);
    return;
  }

  await saveProductRecord(env, { ...record, active: false });
  await sendMessage(
    env,
    chatId,
    [
      `${definition.displayName} feedback closed. No new submissions.`,
      '',
      `Card remains: ${record.shortUrl}`,
      '',
      `Re-open: /product ${slug}`,
    ].join('\n'),
  );
}

async function promptProductForm(env: Env, chatId: number, slug: string): Promise<void> {
  const definition = getProductDefinition(slug);
  if (!definition) {
    await sendMessage(env, chatId, `Unknown product "${slug}".`);
    return;
  }

  const record = await getProductRecord(env, slug);
  if (!record?.active) {
    await sendMessage(
      env,
      chatId,
      `${definition.displayName} feedback is not open yet. An admin must run /product ${slug} first.`,
    );
    return;
  }

  await sendMessage(env, chatId, `${definition.displayName} feedback — open the form:`, {
    replyMarkup: {
      inline_keyboard: [
        [
          {
            text: `${definition.displayName} feedback`,
            web_app: { url: productWebAppUrl(env, slug) },
          },
        ],
        [{ text: 'Open in Telegram', url: productStartAppUrl(slug) }],
      ],
    },
  });
}

export async function handleProductCommand(env: Env, message: TelegramMessage): Promise<void> {
  const text = message.text?.trim() ?? '';
  const chatId = message.chat.id;
  const userId = message.from?.id;
  if (!userId) return;

  const parsed = parseProductCommand(text);

  if (!parsed.slug && !parsed.action) {
    await sendProductHelp(env, chatId);
    return;
  }

  if (parsed.action === 'status') {
    await sendProductHelp(env, chatId);
    return;
  }

  const slug = parsed.slug;
  if (!slug) {
    await sendProductHelp(env, chatId);
    return;
  }

  if (parsed.action === 'close') {
    if (!isAdminUser(env, userId)) {
      await sendMessage(env, chatId, 'Only an admin can close a product feedback session.');
      return;
    }
    await closeProduct(env, chatId, slug);
    return;
  }

  const record = await getProductRecord(env, slug);
  if (!record?.active) {
    if (isAdminUser(env, userId)) {
      await launchProduct(env, chatId, userId, slug);
      return;
    }
    await promptProductForm(env, chatId, slug);
    return;
  }

  await promptProductForm(env, chatId, slug);
}
