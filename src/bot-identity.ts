import type { Env } from './types';

/** Telegram @username (no @). Update after BotFather → Edit Username. Must end with `bot`. */
export const DEFAULT_BOT_USERNAME = 'WLTH_Triage_Bot';

export function resolveBotUsername(env: Pick<Env, 'TELEGRAM_BOT_USERNAME'>): string {
  return env.TELEGRAM_BOT_USERNAME?.trim() || DEFAULT_BOT_USERNAME;
}
