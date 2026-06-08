import { findIncidentForMention } from './seer-handler';
import { postSenseiSlackMessage } from './slack-api';
import { slackThreadLooksLikeSeer } from './slack-thread';
import { formatSlackMentionReply } from './slack-voice';
import type { Env } from '../types';

export type SlackAppMentionEvent = {
  type: 'app_mention';
  user: string;
  text: string;
  ts: string;
  channel: string;
  thread_ts?: string;
  event_ts?: string;
};

const SLACK_EVENT_DEDUP_PREFIX = 'sensei:slack-event:';
const DEDUP_TTL_SECONDS = 600;

function stripBotMentions(text: string): string {
  return text.replace(/<@[A-Z0-9]+>/g, '').trim();
}

async function isDuplicateSlackEvent(env: Env, eventId: string): Promise<boolean> {
  const key = `${SLACK_EVENT_DEDUP_PREFIX}${eventId}`;
  const existing = await env.SESSIONS.get(key);
  if (existing) return true;
  await env.SESSIONS.put(key, '1', { expirationTtl: DEDUP_TTL_SECONDS });
  return false;
}

export async function handleSlackAppMention(env: Env, event: SlackAppMentionEvent): Promise<void> {
  const eventId = event.event_ts ?? event.ts;
  if (await isDuplicateSlackEvent(env, eventId)) return;

  const userText = stripBotMentions(event.text);
  const threadTs = event.thread_ts ?? event.ts;
  const incident = await findIncidentForMention(env, event.channel, event.ts, event.thread_ts);
  const threadHasSeerHints =
    !incident?.seerRootCause &&
    (await slackThreadLooksLikeSeer(env, event.channel, threadTs));

  const reply = formatSlackMentionReply(userText, incident, threadHasSeerHints);
  await postSenseiSlackMessage(env, event.channel, reply, {
    threadTs: event.thread_ts ?? event.ts,
  });
}
