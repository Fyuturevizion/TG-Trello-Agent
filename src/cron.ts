import { tryDeliverPendingSplinterRun } from './splinter/poll-delivery';
import { getWebhookInfo } from './telegram';
import type { Env } from './types';

export async function runPendingSplinterCron(env: Env): Promise<void> {
  const delivered = await tryDeliverPendingSplinterRun(env);
  if (delivered) {
    console.log(JSON.stringify({ event: 'pending_splinter_delivered' }));
  }
}

export async function runWebhookWatchdog(env: Env): Promise<void> {
  const expected = env.WEBHOOK_URL?.trim();
  if (!expected) {
    console.log(JSON.stringify({ event: 'webhook_watchdog_skipped', reason: 'WEBHOOK_URL unset' }));
    return;
  }

  const info = await getWebhookInfo(env);
  const ok = info.url === expected && !info.last_error_date;

  console.log(
    JSON.stringify({
      event: 'webhook_watchdog',
      ok,
      url: info.url,
      expected,
      pending_update_count: info.pending_update_count,
      last_error_date: info.last_error_date ?? null,
      last_error_message: info.last_error_message ?? null,
    }),
  );

  if (!ok) {
    console.error(
      JSON.stringify({
        event: 'webhook_watchdog_alert',
        message: 'Telegram webhook mismatch or recent error',
        url: info.url,
        expected,
        last_error_message: info.last_error_message ?? null,
      }),
    );
  }
}
