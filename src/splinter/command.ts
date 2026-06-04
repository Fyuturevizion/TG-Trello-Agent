import { normalizeCommand } from '../telegram';

/**
 * Admin command to speak with Master Splinter.
 * Telegram menus only allow underscores — register `master_splinter` in BotFather.
 * Both `/master-splinter` and `/master_splinter` work in chat.
 */
export const MASTER_SPLINTER_CMD = '/master-splinter';

/** How Master Splinter refers to himself in instructions (not the Telegram @username). */
export const MASTER_SPLINTER_DISPLAY = 'Master_Splinter';

/** BotFather command menu entry (underscores only). */
export const MASTER_SPLINTER_MENU_CMD = '/master_splinter';

/** Find /master_splinter or /master-splinter anywhere (not only first word). */
export function parseMasterSplinterInvocation(
  text: string,
): { rest: string } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  for (const word of trimmed.split(/\s+/)) {
    const cmd = normalizeCommand(word);
    if (cmd === '/master-splinter' || cmd === '/master_splinter') {
      const idx = trimmed.indexOf(word);
      const rest = idx >= 0 ? trimmed.slice(idx + word.length).trim() : '';
      return { rest };
    }
  }
  return null;
}

/** @deprecated Prefer parseMasterSplinterInvocation */
export function masterSplinterFirstToken(text: string): string {
  const trimmed = text.trim();
  for (const word of trimmed.split(/\s+/)) {
    const cmd = normalizeCommand(word);
    if (cmd === '/master-splinter' || cmd === '/master_splinter') return word;
  }
  return trimmed.split(/\s+/)[0] ?? '';
}

export function isMasterSplinterCommand(text: string): boolean {
  return parseMasterSplinterInvocation(text) !== null;
}
