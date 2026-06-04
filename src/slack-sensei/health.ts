import type { Env } from '../types';
import type { SenseiHealthStatus } from './types';

export function senseiHealthStatus(env: Env): SenseiHealthStatus {
  const slackSigning = Boolean(env.SLACK_SIGNING_SECRET?.trim());
  const slackToken = Boolean(env.SLACK_BOT_TOKEN?.trim());
  const slackChannel = Boolean(env.SLACK_SENSEI_CHANNEL_ID?.trim());
  const sentrySecret = Boolean(env.SENTRY_WEBHOOK_SECRET?.trim());
  const trelloList = Boolean(
    env.TRELLO_SENSEI_LIST_ID?.trim() || env.TRELLO_INBOX_LIST_ID?.trim(),
  );

  return {
    ok: slackSigning && slackToken && slackChannel && sentrySecret && trelloList,
    slack: {
      signingSecret: slackSigning,
      botToken: slackToken,
      channelId: slackChannel,
    },
    sentry: {
      webhookSecret: sentrySecret,
    },
    trello: {
      inboxList: trelloList,
    },
  };
}
