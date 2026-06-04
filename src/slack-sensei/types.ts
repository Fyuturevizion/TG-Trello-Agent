/** Lifecycle for a Slack Sensei incident (Sentry → Slack → Trello → agent). */
export type SenseiIncidentState =
  | 'opened'
  | 'slack_posted'
  | 'trello_created'
  | 'agent_pending'
  | 'agent_running'
  | 'awaiting_approval'
  | 'pr_opened'
  | 'closed'
  | 'error';

export interface SenseiIncident {
  id: string;
  state: SenseiIncidentState;
  source: 'sentry' | 'matomo' | 'manual';
  createdAt: string;
  updatedAt: string;

  /** Sentry issue id or external alert id */
  externalId: string;
  title: string;
  level?: string;
  project?: string;
  culprit?: string;
  sentryUrl?: string;
  stackSnippet?: string;

  slackChannelId?: string;
  slackThreadTs?: string;
  slackMessageTs?: string;

  trelloCardId?: string;
  trelloShortUrl?: string;

  cursorAgentId?: string;
  cursorRunId?: string;

  errorMessage?: string;
}

export interface SenseiHealthStatus {
  ok: boolean;
  slack: {
    signingSecret: boolean;
    botToken: boolean;
    channelId: boolean;
  };
  sentry: {
    webhookSecret: boolean;
  };
  trello: {
    inboxList: boolean;
  };
}
