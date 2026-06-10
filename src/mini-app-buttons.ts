import { resolveBotUsername } from './bot-identity';
import type { InlineButton } from './telegram';
import { webappUrlWithVersion } from './webapp-version';
import type { Env } from './types';

/**
 * Inline keyboard Mini App opener. Telegram rejects t.me?startapp= as url buttons
 * (BUTTON_TYPE_INVALID). Use web_app with the configured WEBAPP_URL instead.
 */
export function miniAppWebButton(
  env: Env,
  text: string,
  queryParams: Record<string, string>,
): InlineButton {
  const base = env.WEBAPP_URL?.trim();
  if (base) {
    return {
      text,
      web_app: { url: webappUrlWithVersion(base, queryParams) },
    };
  }
  const bot = resolveBotUsername(env);
  return { text, url: `https://t.me/${bot}` };
}
