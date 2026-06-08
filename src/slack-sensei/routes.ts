import { Hono } from 'hono';
import { senseiHealthStatus } from './health';
import { handleSeerWebhook } from './seer-handler';
import { handleSentryWebhook } from './sentry-handler';
import { parseSeerWebhook } from './seer-parse';
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
    return handleSlackEventsRequest(
      c.env,
      rawBody,
      c.req.raw.headers,
      (p) => c.executionCtx.waitUntil(p),
    );
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
      const hookResource = c.req.header('sentry-hook-resource')?.toLowerCase();
      if (hookResource === 'seer' || parseSeerWebhook(payload)) {
        const result = await handleSeerWebhook(c.env, payload);
        return c.json({ ok: true, kind: 'seer', ...result });
      }
      const result = await handleSentryWebhook(c.env, payload);
      return c.json({ ok: true, kind: 'sentry', ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(JSON.stringify({ event: 'sentry_webhook_error', error: message }));
      return c.json({ ok: false, error: message }, 500);
    }
  });

  return sensei;
}
