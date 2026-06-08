import {
  findIncidentBySlackThread,
  incidentIdFromSentry,
  loadSenseiIncident,
  patchSenseiIncident,
} from './incidents';
import { parseSeerWebhook } from './seer-parse';
import { postSenseiSlackMessage } from './slack-api';
import type { Env } from '../types';

export async function handleSeerWebhook(env: Env, payload: unknown): Promise<{
  incidentId: string;
  posted: boolean;
}> {
  const parsed = parseSeerWebhook(payload);
  if (!parsed) throw new Error('Unrecognized Seer webhook payload');

  const incidentId = incidentIdFromSentry(parsed.issueId);
  let incident = await loadSenseiIncident(env, incidentId);

  if (!incident) {
    return { incidentId, posted: false };
  }

  incident = (await patchSenseiIncident(env, incidentId, {
    seerRootCause: parsed.summary,
  }))!;

  if (!incident.slackChannelId || !incident.slackThreadTs) {
    return { incidentId, posted: false };
  }

  await postSenseiSlackMessage(
    env,
    incident.slackChannelId,
    `*Seer root cause*\n${parsed.summary.slice(0, 2800)}`,
    { threadTs: incident.slackThreadTs },
  );

  return { incidentId, posted: true };
}

/** Resolve incident when user @mentions inside a thread (not the parent message ts). */
export async function findIncidentForMention(
  env: Env,
  channel: string,
  messageTs: string,
  threadTs?: string,
): Promise<import('./types').SenseiIncident | null> {
  if (threadTs) {
    const byThread = await findIncidentBySlackThread(env, channel, threadTs);
    if (byThread) return byThread;
  }
  return findIncidentBySlackThread(env, channel, messageTs);
}
