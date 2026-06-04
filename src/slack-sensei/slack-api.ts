import type { Env } from '../types';

const SLACK_API = 'https://slack.com/api';

type SlackPostResult = {
  ok: boolean;
  error?: string;
  ts?: string;
  channel?: string;
};

async function slackApi<T>(
  token: string,
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${SLACK_API}/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T & { ok?: boolean; error?: string };
  if (!response.ok || (data as { ok?: boolean }).ok === false) {
    const err = (data as { error?: string }).error ?? response.statusText;
    throw new Error(`Slack ${method}: ${err}`);
  }
  return data;
}

export async function postSenseiSlackMessage(
  env: Env,
  channel: string,
  text: string,
  options?: { threadTs?: string; blocks?: unknown[] },
): Promise<{ ts: string; channel: string }> {
  const token = env.SLACK_BOT_TOKEN?.trim();
  if (!token) throw new Error('SLACK_BOT_TOKEN is not configured');

  const result = await slackApi<SlackPostResult>(token, 'chat.postMessage', {
    channel,
    text,
    thread_ts: options?.threadTs,
    blocks: options?.blocks,
    unfurl_links: false,
    unfurl_media: false,
  });

  if (!result.ts) throw new Error('Slack chat.postMessage: missing ts');
  return { ts: result.ts, channel: result.channel ?? channel };
}
