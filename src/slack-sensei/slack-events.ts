import { verifySlackRequest } from './slack-verify';
import type { Env } from '../types';

type SlackUrlVerification = { type: 'url_verification'; challenge: string };
type SlackEventCallback = { type: 'event_callback'; event?: { type?: string } };

export async function handleSlackEventsRequest(
  env: Env,
  rawBody: string,
  headers: Headers,
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

  // Phase 2b: app_mention, block_actions (approve PR)
  return new Response('', { status: 200 });
}
