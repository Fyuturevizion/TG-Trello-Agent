import { Hono } from 'hono';
import { senseiHealthStatus } from './health';
import { handleSentryWebhook } from './sentry-handler';
import { handleSlackEventsRequest } from './slack-events';
import type { Env } from '../types';

export function createSlackSenseiApp() {
  const sensei = new Hono<{ Bindings: Env }>();

  sensei.get('/health', (c) => {
    const status = senseiHealthStatus(c.env);
    return c.json({ service: 'slack-sensei', ...status }, status.ok ? 200 : 503);
  });

  sensei.post('/events', async (c) => {
    const rawBody = await c.req.text();
    return handleSlackEventsRequest(c.env, rawBody, c.req.raw.headers);
  });

  sensei.post('/sentry/:secret', async (c) => {
    if (c.req.param('secret') !== c.env.SENTRY_WEBHOOK_SECRET) {
      return c.text('Not found', 404);
    }

    let payload: unknown;
    try {
      payload = await c.req.json();
    } catch {
      return c.text('Bad request', 400);
    }

    try {
      const result = await handleSentryWebhook(c.env, payload);
      return c.json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(JSON.stringify({ event: 'sentry_webhook_error', error: message }));
      return c.json({ ok: false, error: message }, 500);
    }
  });

  return sensei;
}
