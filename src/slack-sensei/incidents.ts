import type { Env } from '../types';
import type { SenseiIncident, SenseiIncidentState } from './types';

const KV_PREFIX = 'sensei:incident:';
const THREAD_INDEX_PREFIX = 'sensei:slack-thread:';
const TTL_SECONDS = 30 * 24 * 60 * 60;

function threadIndexKey(channelId: string, threadTs: string): string {
  return `${THREAD_INDEX_PREFIX}${channelId}:${threadTs}`;
}

function kvKey(incidentId: string): string {
  return `${KV_PREFIX}${incidentId}`;
}

export function incidentIdFromSentry(issueId: string): string {
  return `sentry-${issueId}`;
}

export async function saveSenseiIncident(env: Env, incident: SenseiIncident): Promise<void> {
  await env.SESSIONS.put(kvKey(incident.id), JSON.stringify(incident), {
    expirationTtl: TTL_SECONDS,
  });
  if (incident.slackChannelId && incident.slackThreadTs) {
    await env.SESSIONS.put(threadIndexKey(incident.slackChannelId, incident.slackThreadTs), incident.id, {
      expirationTtl: TTL_SECONDS,
    });
  }
}

export async function findIncidentBySlackThread(
  env: Env,
  channelId: string,
  threadTs: string,
): Promise<SenseiIncident | null> {
  const incidentId = await env.SESSIONS.get(threadIndexKey(channelId, threadTs));
  if (!incidentId) return null;
  return loadSenseiIncident(env, incidentId);
}

export async function loadSenseiIncident(
  env: Env,
  incidentId: string,
): Promise<SenseiIncident | null> {
  const raw = await env.SESSIONS.get(kvKey(incidentId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SenseiIncident;
  } catch {
    return null;
  }
}

export async function patchSenseiIncident(
  env: Env,
  incidentId: string,
  patch: Partial<SenseiIncident> & { state?: SenseiIncidentState },
): Promise<SenseiIncident | null> {
  const current = await loadSenseiIncident(env, incidentId);
  if (!current) return null;
  const next: SenseiIncident = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await saveSenseiIncident(env, next);
  return next;
}
