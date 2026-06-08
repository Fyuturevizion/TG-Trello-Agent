import { escapeHtml } from './telegram-format';
import type { Env } from './types';

const KV_PREFIX = 'agent:intruder:';
const TTL_SECONDS = 365 * 24 * 60 * 60;

export interface IntruderRecord {
  count: number;
  firstAt: string;
}

interface IntruderCtx {
  count: number;
  who: string;
  ordinal: string;
  daysStalking: number;
}

type Tier = { from: number; lines: ((ctx: IntruderCtx) => string)[] };

/** Personality escalates with attempts — easy-going → playful → roast → legend. */
const TIERS: Tier[] = [
  {
    from: 1,
    lines: [
      (c) =>
        `Easy there, ${c.who} — this Cursor token isn't yours. It's admin-only, no hard feelings.`,
      (c) =>
        `Wrong button, friend. /master-splinter is for the triage overlord, not the whole realm. Attempt <b>${c.count}</b>.`,
      (c) =>
        `${c.who}, I admire the confidence. The API key? Not yours. Go file a bug the normal way — we're chill.`,
      (c) =>
        `Hi! This agent is rented. Monthly. By one person. Spoiler: not you. (${c.ordinal} knock on the door.)`,
    ],
  },
  {
    from: 2,
    lines: [
      (c) =>
        `Back again, ${c.who}? The token still isn't yours. We're counting: <b>${c.count}</b> and climbing.`,
      (c) =>
        `${c.ordinal} time's the charm, they said. Not for /master-splinter, they didn't say.`,
      (c) =>
        `We see you, ${c.who}. The precious \`crsr_…\` remains with its rightful owner. You get… this message.`,
      (c) =>
        `${c.who} really said "let me just quickly reprogram the bot" — ${c.ordinal} attempt. Love the energy, wrong lobby.`,
    ],
  },
  {
    from: 4,
    lines: [
      (c) =>
        `<b>${c.count} attempts.</b> ${c.who}, at this point you're speed-running rejection. New PB?`,
      (c) =>
        `One does not simply /master-splinter into production. ${c.who} does, apparently. Attempt <b>${c.count}</b>.`,
      (c) =>
        `The fellowship called. They want their unauthorized slash command back. Counter: <b>${c.count}</b>.`,
      (c) =>
        `${c.who}, we've started a spreadsheet. Column A: your username. Column B: "${c.count}". Column C: still no.`,
    ],
  },
  {
    from: 7,
    lines: [
      (c) =>
        `Day ${c.daysStalking} of ${c.who} vs. the admin token. Score: Admin 1 — You <b>${c.count}</b>.`,
      (c) =>
        `Achievement unlocked: <i>Persistent /master-splinter spammer</i> (${c.count}x). Reward: another joke.`,
      (c) =>
        `${c.who} has entered the <b>Hall of Almost-Admins</b>. Requirement: not being admin. You qualify.`,
      (c) =>
        `Error 403: My Precious API Key. Sub-error: ${c.who} cannot into Cursor. Attempt <b>${c.count}</b>.`,
    ],
  },
  {
    from: 12,
    lines: [
      (c) =>
        `Legend status: ${c.who} — <b>${c.count}</b> tries. The token has filed a restraining order.`,
      (c) =>
        `At attempt <b>${c.count}</b>, we legally have to ask: is this a bit? Because it's working.`,
      (c) =>
        `${c.who}, the cloud agent sent a postcard: "Stop knocking. I'm not home. — Admin's API key"`,
      (c) =>
        `<b>${c.count}.</b> That's not an attempt count, that's a lifestyle. The token still isn't yours, precious.`,
    ],
  },
  {
    from: 20,
    lines: [
      (c) =>
        `🏆 ${c.who} — <b>${c.count}</b> attempts. You've won "Most Dedicated Non-Admin." Prize: this message.`,
      (c) =>
        `The bot has evolved. It now only roasts ${c.who} on principle. Attempt <b>${c.count}</b>. Still easy-going. Still no.`,
      (c) =>
        `Scientists studied ${c.who}'s ${c.count} /master-splinter tries. Conclusion: token remains not yours. Paper pending.`,
      (c) =>
        `Final form unlocked (${c.count}x): ${c.who} vs. reality. Reality: admin owns the agent. You own the counter.`,
    ],
  },
];

function kvKey(userId: number): string {
  return `${KV_PREFIX}${userId}`;
}

function ordinal(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

function tierForCount(count: number): Tier {
  let tier = TIERS[0];
  for (const t of TIERS) {
    if (count >= t.from) tier = t;
  }
  return tier;
}

function pickLine(tier: Tier, count: number): (ctx: IntruderCtx) => string {
  const index = (count - tier.from) % tier.lines.length;
  return tier.lines[index]!;
}

export async function recordIntruderAttempt(env: Env, userId: number): Promise<IntruderRecord> {
  const key = kvKey(userId);
  const raw = await env.SESSIONS.get(key);
  let record: IntruderRecord;
  if (raw) {
    try {
      record = JSON.parse(raw) as IntruderRecord;
      record.count = (record.count || 0) + 1;
    } catch {
      const legacy = Number.parseInt(raw, 10);
      record = {
        count: (Number.isFinite(legacy) ? legacy : 0) + 1,
        firstAt: new Date().toISOString(),
      };
    }
  } else {
    record = { count: 1, firstAt: new Date().toISOString() };
  }
  await env.SESSIONS.put(key, JSON.stringify(record), { expirationTtl: TTL_SECONDS });
  return record;
}

export function buildIntruderReply(
  record: IntruderRecord,
  username?: string,
  firstName?: string,
): string {
  const { count, firstAt } = record;
  const who = username
    ? `@${escapeHtml(username)}`
    : firstName
      ? escapeHtml(firstName)
      : 'friend';
  const ctx: IntruderCtx = {
    count,
    who,
    ordinal: ordinal(count),
    daysStalking: daysSince(firstAt),
  };

  const tier = tierForCount(count);
  const line = pickLine(tier, count)(ctx);

  const footer =
    count >= 12
      ? `📊 Lifetime knock count: <b>${count}</b> · Tier: <i>legendary nuisance</i>`
      : count >= 7
        ? `📊 Attempts: <b>${count}</b> · Tier: <i>regular</i> · Days on this quest: <b>${ctx.daysStalking}</b>`
        : count >= 4
          ? `📊 Attempts: <b>${count}</b> · Tier: <i>getting bold</i>`
          : `📊 Attempts: <b>${count}</b> · Still not your token.`;

  return [line, '', footer].join('\n');
}
