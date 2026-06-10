import { isReporterCommand, isUtilityCommand, textContainsReporterCommand } from '../commands/registry';
import { messageText } from '../telegram-message';
import { isMasterSplinterCommand } from './command';
import { callsMasterSplinterByName, mentionsSplinterDisplayHandle } from './summon';
import type { Env, TelegramMessage } from '../types';

/** Admin reached for Splinter without /master_splinter (e.g. @master_splinter Hello). */
export function isAdminSplinterPing(message: TelegramMessage, _env: Env): boolean {
  const text = messageText(message);
  if (!text) return false;
  if (isMasterSplinterCommand(text)) return false;
  if (isReporterCommand(text) || isUtilityCommand(text) || textContainsReporterCommand(text)) {
    return false;
  }

  // Do not treat casual @WLTH_Triage_Bot channel banter as an admin Splinter prompt.
  if (mentionsSplinterDisplayHandle(text)) return true;
  if (callsMasterSplinterByName(text)) return true;
  return false;
}

/** Strip bot / Splinter mentions; default to a short ping if nothing left. */
export function extractAdminSplinterPrompt(text: string, botUsername: string): string {
  let rest = text;
  const botHandle = `@${botUsername.replace(/^@/, '')}`;
  rest = rest.replace(new RegExp(botHandle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
  rest = rest.replace(/@master[\s_-]*splinter/gi, ' ');
  rest = rest.replace(/\bmaster[\s_-]*splinter\b/gi, ' ');
  rest = rest.replace(/\s+/g, ' ').trim();
  return rest || 'Hello';
}
