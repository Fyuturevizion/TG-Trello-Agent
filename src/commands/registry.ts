import { normalizeCommand } from '../telegram';

/** Always available in any chat (no QA gate). */
export const UTILITY_COMMANDS = ['/chatid', '/myid'] as const;

/** QA channel / admin DM — triage Mini App and help. */
export const REPORTER_COMMANDS = [
  '/report',
  '/bug',
  '/wishlist',
  '/product',
  '/help',
  '/start',
  '/cancel',
  '/setup',
] as const;

export type UtilityCommand = (typeof UTILITY_COMMANDS)[number];
export type ReporterCommand = (typeof REPORTER_COMMANDS)[number];

const UTILITY_SET = new Set<string>(UTILITY_COMMANDS);
const REPORTER_SET = new Set<string>(REPORTER_COMMANDS);

export function commandToken(text: string): string {
  return normalizeCommand(text.trim().split(/\s+/)[0] ?? '');
}

/** Find a known command anywhere in the message (group chats often mention the bot first). */
export function findCommandInText(text: string, commands: readonly string[]): string | null {
  const set = new Set<string>(commands);
  for (const word of text.trim().split(/\s+/)) {
    const cmd = normalizeCommand(word);
    if (set.has(cmd)) return cmd;
  }
  return null;
}

export function textContainsReporterCommand(text: string): boolean {
  return findCommandInText(text, REPORTER_COMMANDS) !== null;
}

export function isUtilityCommand(text: string): boolean {
  return UTILITY_SET.has(commandToken(text));
}

export function isReporterCommand(text: string): boolean {
  return REPORTER_SET.has(commandToken(text));
}
