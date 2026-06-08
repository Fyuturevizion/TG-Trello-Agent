import { handleSlackAppMention, type SlackAppMentionEvent } from './app-mention';
import { verifySlackRequest } from './slack-verify';
import type { Env } from '../types';

type SlackUrlVerification = { type: 'url_verification'; challenge: string };

type SlackEventCallback = {
  type: 'event_callback';
  event?: SlackAppMentionEvent & { type?: string };
  event_id?: string;
};

export async function handleSlackEventsRequest(
  env: Env,
  rawBody: string,
  headers: Headers,
  waitUntil?: (promise: Promise<unknown>) => void,
): Promise<Response> {
  const signingSecret = env.SLACK_SIGNING_SECRET?.trim();
  if (!signingSecret) {
    return new Response('Slack signing secret not configured', { status: 503 });
  }

  const ok = await verifySlackRequest(
    signingSecret,
    rawBody,
    headers.get('x-slack-request-timestamp') ?? undefined,
    headers.get('x-slack-signature') ?? undefined,
  );
  if (!ok) return new Response('Invalid signature', { status: 401 });

  let body: SlackUrlVerification | SlackEventCallback;
  try {
    body = JSON.parse(rawBody) as SlackUrlVerification | SlackEventCallback;
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  if (body.type === 'url_verification' && 'challenge' in body) {
    return Response.json({ challenge: body.challenge });
  }

  if (body.type === 'event_callback' && body.event?.type === 'app_mention') {
    const event = body.event;
    const work = handleSlackAppMention(env, event).catch((error) => {
      console.error(
        JSON.stringify({
          event: 'slack_app_mention_error',
          channel: event.channel,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });
    if (waitUntil) waitUntil(work);
    else await work;
  }

  return new Response('', { status: 200 });
}
