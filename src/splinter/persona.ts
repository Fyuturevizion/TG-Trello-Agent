import type { Env } from '../types';

export const DEFAULT_MASTER_DISPLAY = 'Master_Splinter';
export const DEFAULT_DONATELLO_DISPLAY = 'Donatello_Splinterson';

/** Content-creation bot (Donatello) vs QA triage bot (Master Splinter). */
export function isContentBot(env: Pick<Env, 'SPLINTER_BOT_MODE'>): boolean {
  return env.SPLINTER_BOT_MODE?.trim().toLowerCase() === 'content';
}

export function resolveSplinterDisplay(
  env: Pick<Env, 'SPLINTER_DISPLAY_NAME' | 'SPLINTER_BOT_MODE'>,
): string {
  const override = env.SPLINTER_DISPLAY_NAME?.trim();
  if (override) return override;
  if (isContentBot(env)) return DEFAULT_DONATELLO_DISPLAY;
  return DEFAULT_MASTER_DISPLAY;
}

export function splinterRoleLine(env: Env): string {
  if (isContentBot(env)) {
    return 'creative aide for WLTH content: copy, campaigns, scripts, and channel posts';
  }
  return 'maintainer of the WLTH Telegram → Trello triage bot';
}

export function splinterRepoBlurb(env: Env): string {
  if (isContentBot(env)) {
    return 'You help the content team draft, refine, and ship creative work through Telegram.';
  }
  return 'You maintain the WLTH Telegram → Trello triage bot (Cloudflare Worker, Hono, Mini App in public/, webhooks).';
}
