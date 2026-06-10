import { isReporterCommand, isUtilityCommand, textContainsReporterCommand } from '../commands/registry';
import { isMasterSplinterCommand } from './command';
import type { Env, TelegramMessage } from '../types';

function sliceEntity(text: string, offset: number, length: number): string {
  return text.slice(offset, offset + length);
}

/** @master_splinter style mention — not the triage bot @WLTH_Triage_Bot handle. */
export function mentionsSplinterDisplayHandle(text: string): boolean {
  return /@master[\s_-]*splinter\b/i.test(text);
}

export function callsMasterSplinterByName(text: string): boolean {
  return /\bmaster[\s_-]*splinter\b/i.test(text);
}

export type SplinterSummonKind = 'command' | 'mention' | 'name';

function isAllowedNonSplinterMessage(text: string): boolean {
  return (
    isReporterCommand(text) ||
    isUtilityCommand(text) ||
    textContainsReporterCommand(text)
  );
}

/** Non-admin tried to reach Master Splinter without using allowed reporter commands. */
export function detectUnauthorizedSplinterSummon(
  message: TelegramMessage,
  _env: Env,
): SplinterSummonKind | null {
  const text = message.text?.trim() ?? message.caption?.trim() ?? '';
  if (!text) return null;

  if (isMasterSplinterCommand(text)) return null;
  if (isAllowedNonSplinterMessage(text)) return null;

  // Casual @WLTH_Triage_Bot banter is not a Splinter summon — only @master_splinter / by name.
  if (mentionsSplinterDisplayHandle(text)) return 'mention';
  if (callsMasterSplinterByName(text)) return 'name';

  return null;
}

/** @deprecated Only used by tests / legacy — triage bot handle is not a Splinter summon. */
export function messageMentionsBot(
  message: TelegramMessage,
  username: string,
  botUserId?: number,
): boolean {
  const text = message.text?.trim() ?? message.caption?.trim() ?? '';
  if (!text) return false;

  const handle = `@${username.replace(/^@/, '')}`;
  if (text.toLowerCase().includes(handle.toLowerCase())) return true;

  const entities = [...(message.entities ?? []), ...(message.caption_entities ?? [])];
  for (const entity of entities) {
    if (entity.type === 'mention') {
      const mention = sliceEntity(text, entity.offset, entity.length);
      if (mention.toLowerCase() === handle.toLowerCase()) return true;
    }
    if (entity.type === 'text_mention' && entity.user?.is_bot && botUserId) {
      if (entity.user.id === botUserId) return true;
    }
  }
  return false;
}
