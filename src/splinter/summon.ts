import {
  isReporterCommand,
  isUtilityCommand,
  textContainsReporterCommand,
} from '../commands/registry';
import { resolveBotUsername } from '../bot-identity';
import { messageText } from '../telegram-message';
import { isMasterSplinterCommand } from './command';
import type { Env, TelegramMessage } from '../types';

function sliceEntity(text: string, offset: number, length: number): string {
  return text.slice(offset, offset + length);
}

/** @WLTH_Triage_Bot or entity mention of the bot. */
export function messageMentionsBot(
  message: TelegramMessage,
  username: string,
  botUserId?: number,
): boolean {
  const text = messageText(message);
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
  env: Env,
): SplinterSummonKind | null {
  const text = messageText(message);
  if (!text) return null;

  if (isMasterSplinterCommand(text)) return null;
  if (isAllowedNonSplinterMessage(text)) return null;

  const user = resolveBotUsername(env);
  const botId = env.TELEGRAM_BOT_ID ? Number(env.TELEGRAM_BOT_ID) : undefined;
  if (messageMentionsBot(message, user, botId)) return 'mention';
  if (callsMasterSplinterByName(text)) return 'name';

  return null;
}
