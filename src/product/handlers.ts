import { postChannelTriggers } from '../bot-handlers';
import { announceProductClosed, announceProductOpened } from './announce';
import { createProductHubCard } from './trello';
import {
  clearActiveProduct,
  loadActiveProduct,
  normalizeProductSlug,
  saveActiveProduct,
  slugToDisplayName,
} from './session';
import { resolveBotUsername } from '../bot-identity';
import { escapeHtml } from '../telegram-format';
import { isAdminUser, normalizeCommand, sendMessage } from '../telegram';
import type { Env, TelegramMessage } from '../types';

function productArgs(text: string): string {
  return text.replace(/^\/product(?:@\S+)?\s*/i, '').trim();
}

export async function handleProductMessage(env: Env, message: TelegramMessage): Promise<boolean> {
  const text = message.text?.trim() ?? '';
  const first = normalizeCommand(text.split(/\s+/)[0] ?? '');
  if (first !== '/product') return false;

  const chatId = message.chat.id;
  const userId = message.from?.id;
  if (!userId) return true;

  const args = productArgs(text);
  const isAdmin = await isAdminUser(env, userId);

  if (!args) {
    const active = await loadActiveProduct(env);
    if (!active) {
      await sendMessage(
        env,
        chatId,
        'No product feedback round is open right now. Bug and wishlist triage still work via /report.',
      );
      return true;
    }
    const bot = resolveBotUsername(env);
    await sendMessage(
      env,
      chatId,
      [
        `<b>${escapeHtml(active.displayName)}</b> feedback is open.`,
        'Tap below to add your notes to the shared Trello card.',
      ].join('\n'),
      {
        parseMode: 'HTML',
        replyMarkup: {
          inline_keyboard: [
            [
              {
                text: `${active.displayName} feedback`,
                url: `https://t.me/${bot}?startapp=product`,
              },
            ],
          ],
        },
      },
    );
    return true;
  }

  const sub = args.split(/\s+/)[0]?.toLowerCase();

  if (sub === 'status') {
    const active = await loadActiveProduct(env);
    if (!active) {
      await sendMessage(env, chatId, 'No active product feedback round.');
      return true;
    }
    await sendMessage(
      env,
      chatId,
      [
        `<b>${escapeHtml(active.displayName)}</b> (<code>${escapeHtml(active.slug)}</code>)`,
        `Items on card: ${active.feedbackCount ?? 0}`,
        `<a href="${escapeHtml(active.shortUrl)}">Open Trello hub</a>`,
        '',
        'Reporters: <code>/product</code>',
        isAdmin ? 'Admin: <code>/product close</code>' : '',
      ]
        .filter(Boolean)
        .join('\n'),
      { parseMode: 'HTML' },
    );
    return true;
  }

  if (sub === 'close') {
    if (!isAdmin) {
      await sendMessage(env, chatId, 'Only admins can close a product feedback round.');
      return true;
    }
    const active = await loadActiveProduct(env);
    if (!active) {
      await sendMessage(env, chatId, 'Nothing to close.');
      return true;
    }
    await clearActiveProduct(env);
    await announceProductClosed(env, active.displayName);
    try {
      await postChannelTriggers(env);
    } catch {
      // Bot may lack pin rights; admin can run /setup manually.
    }
    await sendMessage(
      env,
      chatId,
      `Closed <b>${escapeHtml(active.displayName)}</b>. The Trello hub card remains for triage.`,
      { parseMode: 'HTML' },
    );
    return true;
  }

  if (!isAdmin) {
    await sendMessage(
      env,
      chatId,
      'Use <code>/product</code> without arguments to submit feedback. Admins open rounds with <code>/product marketplace</code>.',
      { parseMode: 'HTML' },
    );
    return true;
  }

  const slug = normalizeProductSlug(sub);
  if (!slug) {
    await sendMessage(env, chatId, 'Usage: /product &lt;slug&gt; (e.g. marketplace)');
    return true;
  }

  const displayName = slugToDisplayName(slug);
  const existing = await loadActiveProduct(env);
  if (existing?.slug === slug) {
    await sendMessage(
      env,
      chatId,
      [
        `<b>${escapeHtml(displayName)}</b> is already open.`,
        `<a href="${escapeHtml(existing.shortUrl)}">Open Trello hub</a>`,
      ].join('\n'),
      { parseMode: 'HTML' },
    );
    return true;
  }

  if (existing) {
    await sendMessage(
      env,
      chatId,
      `Close <b>${escapeHtml(existing.displayName)}</b> first (<code>/product close</code>), then open ${slug}.`,
      { parseMode: 'HTML' },
    );
    return true;
  }

  try {
    const hub = await createProductHubCard(env, displayName, slug, userId);
    const campaign = {
      slug,
      displayName,
      cardId: hub.cardId,
      shortUrl: hub.shortUrl,
      checklistIds: hub.checklistIds,
      openedAt: new Date().toISOString(),
      openedBy: userId,
      open: true,
      feedbackCount: 0,
    };
    await saveActiveProduct(env, campaign);
    await announceProductOpened(env, { displayName, shortUrl: hub.shortUrl });
    try {
      await postChannelTriggers(env);
    } catch {
      // Bot may lack pin rights; admin can run /setup manually.
    }

    await sendMessage(
      env,
      chatId,
      [
        `<b>${escapeHtml(displayName)}</b> feedback is live.`,
        '',
        'One Trello card — each area has its own checklist; submissions append as items + comments.',
        `<a href="${escapeHtml(hub.shortUrl)}">${escapeHtml(hub.name)}</a>`,
        '',
        'Channel buttons are refreshed. Reporters can tap <b>Product feedback</b> or send <code>/product</code>.',
      ].join('\n'),
      { parseMode: 'HTML' },
    );
  } catch (error) {
    await sendMessage(
      env,
      chatId,
      escapeHtml(error instanceof Error ? error.message : String(error)),
      { parseMode: 'HTML' },
    );
  }

  return true;
}
