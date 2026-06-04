import {
  incidentIdFromSentry,
  loadSenseiIncident,
  patchSenseiIncident,
  saveSenseiIncident,
} from './incidents';
import { parseSentryWebhook } from './sentry-parse';
import { postSenseiSlackMessage } from './slack-api';
import { createSenseiTrelloCard } from './trello-incident';
import type { Env } from '../types';
import type { SenseiIncident } from './types';

function slackThreadPermalink(channel: string, ts: string): string {
  const compact = ts.replace('.', '');
  return `https://slack.com/archives/${channel}/p${compact}`;
}

function formatSlackAlertText(issue: {
  title: string;
  level?: string;
  project?: string;
  culprit?: string;
  permalink?: string;
  stackSnippet?: string;
}): string {
  const lines = [
    `*Sentry:* ${issue.title}`,
    issue.level ? `*Level:* ${issue.level}` : null,
    issue.project ? `*Project:* ${issue.project}` : null,
    issue.culprit ? `*Culprit:* ${issue.culprit}` : null,
    issue.permalink ? `<${issue.permalink}|Open in Sentry>` : null,
  ].filter(Boolean);
  if (issue.stackSnippet) {
    lines.push('', '```', issue.stackSnippet.slice(0, 2800), '```');
  }
  lines.push('', '_Slack Sensei · Trello card incoming · no agent on this PR yet_');
  return lines.join('\n');
}

export async function handleSentryWebhook(env: Env, payload: unknown): Promise<{
  incidentId: string;
  duplicate: boolean;
}> {
  const parsed = parseSentryWebhook(payload);
  if (!parsed) throw new Error('Unrecognized Sentry webhook payload');

  const incidentId = incidentIdFromSentry(parsed.issueId);
  const existing = await loadSenseiIncident(env, incidentId);
  if (existing?.slackThreadTs && existing.trelloCardId) {
    return { incidentId, duplicate: true };
  }

  const channelId = env.SLACK_SENSEI_CHANNEL_ID?.trim();
  if (!channelId) throw new Error('SLACK_SENSEI_CHANNEL_ID is not configured');

  let incident: SenseiIncident = existing ?? {
    id: incidentId,
    state: 'opened',
    source: 'sentry',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    externalId: parsed.issueId,
    title: parsed.title,
    level: parsed.level,
    project: parsed.project,
    culprit: parsed.culprit,
    sentryUrl: parsed.permalink,
    stackSnippet: parsed.stackSnippet,
    slackChannelId: channelId,
  };

  await saveSenseiIncident(env, incident);

  const slack = await postSenseiSlackMessage(
    env,
    channelId,
    formatSlackAlertText(parsed),
  );

  incident = (await patchSenseiIncident(env, incidentId, {
    state: 'slack_posted',
    slackMessageTs: slack.ts,
    slackThreadTs: slack.ts,
  }))!;

  const threadUrl = slackThreadPermalink(channelId, slack.ts);
  const card = await createSenseiTrelloCard(env, parsed, threadUrl);

  await patchSenseiIncident(env, incidentId, {
    state: 'trello_created',
    trelloCardId: card.id,
    trelloShortUrl: card.shortUrl,
  });

  await postSenseiSlackMessage(
    env,
    channelId,
    `*Trello:* <${card.shortUrl}|${card.name}>`,
    { threadTs: slack.ts },
  );

  return { incidentId, duplicate: false };
}
