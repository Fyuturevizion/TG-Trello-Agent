import { splinterIntruderQuote } from './quotes';
import {
  detectUnauthorizedSplinterSummon,
  type SplinterSummonKind,
} from './summon';
import { escapeHtml } from '../telegram-format';
import { canSummonSplinter } from '../dojo-access';
import { sendMessage } from '../telegram';
import type { Env, TelegramMessage } from '../types';

const KV_PREFIX = 'agent:intruder:';
const TTL_SECONDS = 365 * 24 * 60 * 60;

export interface IntruderRecord {
  count: number;
  firstAt: string;
  commandAttempts: number;
  mentionAttempts: number;
  nameAttempts: number;
}

function kvKey(userId: number): string {
  return `${KV_PREFIX}${userId}`;
}

export function turtleRank(count: number): string {
  if (count >= 51) return 'Legendary Splinter-botherer';
  if (count >= 21) return 'Persistent /master-splinter tapper';
  if (count >= 11) return 'Sewer stormer';
  if (count >= 6) return 'Dojo fence-hopper';
  if (count >= 4) return 'Sewer lurker';
  if (count >= 2) return 'Curious shell-bumper';
  return 'Hatchling door-scratcher';
}

const MENTION_JOKES: readonly ((who: string, count: number) => string)[] = [
  (who) =>
    `${who}, you tagged me in the channel like summoning a sensei with a rubber band. I am not yours to ping.`,
  (who, count) =>
    `${who}, @-mention attempt ${count}. The notification reached me. Permission did not.`,
  (who) =>
    `${who}, you cry my name across the wire, but the dojo door opens for one admin only.`,
  (who, count) =>
    `${who}, ${count} tags and still no seat at the mat. File /report, young turtle.`,
];

function mentionJoke(who: string, count: number): string {
  return MENTION_JOKES[(count - 1) % MENTION_JOKES.length](who, count);
}

export async function recordIntruderAttempt(
  env: Env,
  userId: number,
  kind: SplinterSummonKind = 'command',
): Promise<IntruderRecord> {
  const key = kvKey(userId);
  const raw = await env.SESSIONS.get(key);
  let record: IntruderRecord;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<IntruderRecord>;
      record = {
        count: parsed.count ?? 0,
        firstAt: parsed.firstAt ?? new Date().toISOString(),
        commandAttempts: parsed.commandAttempts ?? 0,
        mentionAttempts: parsed.mentionAttempts ?? 0,
        nameAttempts: parsed.nameAttempts ?? 0,
      };
    } catch {
      const legacy = Number.parseInt(raw, 10);
      record = {
        count: Number.isFinite(legacy) ? legacy : 0,
        firstAt: new Date().toISOString(),
        commandAttempts: Number.isFinite(legacy) ? legacy : 0,
        mentionAttempts: 0,
        nameAttempts: 0,
      };
    }
  } else {
    record = {
      count: 0,
      firstAt: new Date().toISOString(),
      commandAttempts: 0,
      mentionAttempts: 0,
      nameAttempts: 0,
    };
  }

  record.count += 1;
  if (kind === 'command') record.commandAttempts += 1;
  else if (kind === 'mention') record.mentionAttempts += 1;
  else record.nameAttempts += 1;

  await env.SESSIONS.put(key, JSON.stringify(record), { expirationTtl: TTL_SECONDS });
  return record;
}

function summonIntro(kind: SplinterSummonKind, whoDisplay: string, count: number): string {
  if (kind === 'mention') {
    return `🐢 Young turtle ${whoDisplay}, you <b>@tagged</b> me without access · failed summon <b>#${count}</b>`;
  }
  if (kind === 'name') {
    return `🐢 Young turtle ${whoDisplay}, you called my name without access · failed summon <b>#${count}</b>`;
  }
  return `🐢 Young turtle ${whoDisplay}, break-in attempt <b>#${count}</b>`;
}

export function buildIntruderReply(
  record: IntruderRecord,
  username: string | undefined,
  firstName: string | undefined,
  kind: SplinterSummonKind = 'command',
): string {
  const { count } = record;
  const plainWho = username ? `@${username}` : firstName ?? 'young one';
  const whoDisplay = escapeHtml(plainWho);
  const quote =
    kind === 'mention'
      ? escapeHtml(mentionJoke(plainWho, count))
      : escapeHtml(splinterIntruderQuote(plainWho, count));
  const rank = escapeHtml(turtleRank(count));

  const stats = [
    `Total failed summons: <b>${count}</b>`,
    record.mentionAttempts > 0 ? `Tags: <b>${record.mentionAttempts}</b>` : null,
    record.commandAttempts > 0 ? `Commands: <b>${record.commandAttempts}</b>` : null,
    record.nameAttempts > 0 ? `By name: <b>${record.nameAttempts}</b>` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return [
    '🐀 <b>Master Splinter</b>',
    '',
    summonIntro(kind, whoDisplay, count),
    '',
    `<i>"${quote}"</i>`,
    '',
    'I speak only to the dojo admin. Train with <code>/report</code> or <code>/bug</code>.',
    '',
    `🥋 ${stats}`,
    `Turtle rank: <i>${rank}</i>`,
  ].join('\n');
}

export async function handleUnauthorizedSplinterSummon(
  env: Env,
  message: TelegramMessage,
): Promise<boolean> {
  const userId = message.from?.id;
  if (!userId || (await canSummonSplinter(env, userId, message.from?.username))) return false;

  const kind = detectUnauthorizedSplinterSummon(message, env);
  if (!kind) return false;

  const record = await recordIntruderAttempt(env, userId, kind);
  await sendMessage(
    env,
    message.chat.id,
    buildIntruderReply(record, message.from?.username, message.from?.first_name, kind),
    { parseMode: 'HTML' },
  );
  return true;
}
