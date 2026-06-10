import { resolveBotUsername } from './bot-identity';
import type { InlineButton } from './telegram';
import { webappUrlWithVersion } from './webapp-version';
import type { Env } from './types';

/** startapp values for inline url buttons (no underscores — safer in group keyboards). */
export function miniAppStartParam(kind: 'bug' | 'wishlist' | 'product', productSlug?: string): string {
  if (kind === 'bug') return 'bug';
  if (kind === 'wishlist') return 'wishlist';
  const slug = (productSlug ?? 'marketplace').replace(/[^a-z0-9]/gi, '').toLowerCase();
  return `p${slug}`;
}

export function parseMiniAppStartParam(startParam: string): {
  type?: 'bug' | 'wishlist';
  productSlug?: string;
} | null {
  const raw = startParam.trim().toLowerCase();
  if (raw === 'bug') return { type: 'bug' };
  if (raw === 'wishlist' || raw === 'idea') return { type: 'wishlist' };
  if (raw.startsWith('product_')) return { productSlug: raw.slice('product_'.length) };
  if (raw.startsWith('p') && raw.length > 1) {
    const slug = raw.slice(1);
    if (slug) return { productSlug: slug };
  }
  return null;
}

function isPrivateChat(chatType?: string): boolean {
  return chatType === 'private';
}

/**
 * Inline Mini App opener. web_app buttons only work in private chats with the bot.
 * In QA groups/channels use t.me?startapp= url buttons (Direct Link Mini App).
 */
export function miniAppInlineButton(
  env: Env,
  text: string,
  options: {
    chatType?: string;
    startapp: string;
    query?: Record<string, string>;
  },
): InlineButton {
  const base = env.WEBAPP_URL?.trim();
  if (isPrivateChat(options.chatType) && base) {
    return {
      text,
      web_app: { url: webappUrlWithVersion(base, options.query ?? {}) },
    };
  }

  const bot = resolveBotUsername(env);
  return {
    text,
    url: `https://t.me/${bot}?startapp=${encodeURIComponent(options.startapp)}`,
  };
}

export function reportBugButton(env: Env, chatType?: string): InlineButton {
  return miniAppInlineButton(env, 'Report bug', {
    chatType,
    startapp: miniAppStartParam('bug'),
    query: { type: 'bug' },
  });
}

export function wishlistButton(env: Env, chatType?: string): InlineButton {
  return miniAppInlineButton(env, 'Wishlist', {
    chatType,
    startapp: miniAppStartParam('wishlist'),
    query: { type: 'wishlist' },
  });
}

export function productFeedbackButton(
  env: Env,
  label: string,
  productSlug: string,
  chatType?: string,
): InlineButton {
  return miniAppInlineButton(env, label, {
    chatType,
    startapp: miniAppStartParam('product', productSlug),
    query: { product: productSlug },
  });
}
