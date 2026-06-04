import { Hono } from 'hono';
import { handleReportSubmit } from './api/report';
import { dispatchTelegramUpdate } from './commands/dispatch';
import { postChannelTriggers } from './bot-handlers';
import { runPendingSplinterCron, runWebhookWatchdog } from './cron';
import { pollSplinterRunOnce } from './splinter/poll-delivery';
import { createSlackSenseiApp } from './slack-sensei';
import { senseiHealthStatus } from './slack-sensei/health';
import { isDuplicateUpdate } from './idempotency';
import { handleTrelloWebhook } from './trello-events';
import { sendMessage } from './telegram';
import type { Env, TelegramUpdate } from './types';

const app = new Hono<{ Bindings: Env }>();

app.get('/health', (c) => {
  const configured = Boolean(
    c.env.TELEGRAM_BOT_TOKEN &&
      c.env.TELEGRAM_WEBHOOK_SECRET &&
      c.env.TELEGRAM_QA_CHAT_ID &&
      c.env.TRELLO_API_KEY &&
      c.env.TRELLO_TOKEN &&
      c.env.TRELLO_INBOX_LIST_ID &&
      c.env.WEBAPP_URL,
  );
  const sensei = senseiHealthStatus(c.env);
  return c.json({
    ok: configured,
    webhook: c.env.WEBHOOK_URL ? 'configured' : 'unset',
    webapp: c.env.WEBAPP_URL ?? 'unset',
    service: 'wlth-tg-trello-triage',
    slackSensei: sensei,
  });
});

app.route('/slack-sensei', createSlackSenseiApp());

app.post('/api/report', async (c) => {
  try {
    const body = await c.req.json();
    const result = await handleReportSubmit(c.env, body);
    if (!result.ok) {
      return c.json({ ok: false, error: result.error }, result.status as 400 | 401);
    }
    return c.json({ ok: true, shortUrl: result.shortUrl, name: result.name });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'api_report_error',
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return c.json({ ok: false, error: 'Internal error' }, 500);
  }
});

app.post('/trello-webhook/:secret', async (c) => {
  if (c.req.param('secret') !== c.env.TELEGRAM_WEBHOOK_SECRET) {
    return c.text('Not found', 404);
  }

  if (c.req.method === 'HEAD') {
    return c.text('OK');
  }

  let payload: unknown;
  try {
    payload = await c.req.json();
  } catch {
    return c.text('OK');
  }

  c.executionCtx.waitUntil(
    handleTrelloWebhook(c.env, payload as Parameters<typeof handleTrelloWebhook>[1]).catch(
      (error) => {
        console.error(
          JSON.stringify({
            event: 'trello_webhook_error',
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      },
    ),
  );

  return c.text('OK');
});

app.post('/internal/splinter-poll/:secret', async (c) => {
  if (c.req.param('secret') !== c.env.TELEGRAM_WEBHOOK_SECRET) {
    return c.text('Not found', 404);
  }

  c.executionCtx.waitUntil(
    pollSplinterRunOnce(c.env, c.executionCtx).catch((error) => {
      console.error(
        JSON.stringify({
          event: 'splinter_poll_handler_error',
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }),
  );

  return c.json({ ok: true });
});

app.post('/webhook/:secret', async (c) => {
  const secret = c.req.param('secret');
  if (secret !== c.env.TELEGRAM_WEBHOOK_SECRET) {
    return c.text('Not found', 404);
  }

  let update: TelegramUpdate;
  try {
    update = await c.req.json<TelegramUpdate>();
  } catch {
    return c.text('Bad request', 400);
  }

  if (await isDuplicateUpdate(c.env, update.update_id)) {
    return c.text('OK');
  }

  c.executionCtx.waitUntil(processUpdate(c.env, update, c.executionCtx));
  return c.text('OK');
});

async function processUpdate(
  env: Env,
  update: TelegramUpdate,
  executionCtx: ExecutionContext,
): Promise<void> {
  try {
    await dispatchTelegramUpdate(env, update, executionCtx);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify({
        event: 'update_handler_error',
        update_id: update.update_id,
        error: errMsg,
        stack: error instanceof Error ? error.stack : undefined,
      }),
    );
    try {
      if (update.message?.chat?.id) {
        await sendMessage(
          env,
          update.message.chat.id,
          `Bot error: ${errMsg.slice(0, 500)}`,
        );
      }
    } catch {
      // ignore notify failure
    }
  }
}

function withTelegramWebAppHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.delete('X-Frame-Options');
  headers.set(
    'Content-Security-Policy',
    "frame-ancestors https://web.telegram.org https://*.telegram.org https://telegram.org",
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function assetCacheHeaders(pathname: string): Record<string, string> {
  const isHtml =
    pathname === '/' || pathname.endsWith('.html') || !pathname.includes('.');
  if (isHtml) {
    return { 'Cache-Control': 'no-store, no-cache, must-revalidate', Pragma: 'no-cache' };
  }
  return { 'Cache-Control': 'no-store' };
}

app.get('*', async (c) => {
  const url = new URL(c.req.url);
  url.search = '';
  const assetReq = new Request(url.toString(), c.req.raw);
  let res = await c.env.ASSETS.fetch(assetReq);
  if (res.status === 404) {
    const indexUrl = new URL('/index.html', url.origin);
    res = await c.env.ASSETS.fetch(new Request(indexUrl.toString(), c.req.raw));
  }
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(assetCacheHeaders(url.pathname))) {
    headers.set(k, v);
  }
  res = new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  return withTelegramWebAppHeaders(res);
});

export default {
  fetch: app.fetch,
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(
      Promise.all([
        runPendingSplinterCron(env),
        controller.cron === '0 8 * * *' ? runWebhookWatchdog(env) : Promise.resolve(),
      ]).catch((error) => {
        console.error(
          JSON.stringify({
            event: 'cron_error',
            cron: controller.cron,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }),
    );
  },
};

export { postChannelTriggers };
