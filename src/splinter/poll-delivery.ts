import { MASTER_SPLINTER_CMD } from './command';
import {
  clearPendingSplinterRun,
  loadPendingSplinterRun,
  type PendingSplinterRun,
} from './pending-run';
import { deliverRunReply } from './relay';
import { getRun, isTerminalRunStatus } from '../cursor-api';
import { deleteMessage, sendMessage } from '../telegram';
import type { Env } from '../types';

const POLL_INTERVAL_MS = 3000;
const MAX_RUN_AGE_MS = 45 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function splinterPollUrl(env: Env): string | null {
  const base = env.WEBAPP_URL?.trim().replace(/\/$/, '');
  const secret = env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!base || !secret) return null;
  return `${base}/internal/splinter-poll/${secret}`;
}

type WaitUntilContext = Pick<ExecutionContext, 'waitUntil'>;

/** Start chained polls — each HTTP request gets a fresh Worker budget until Cursor finishes. */
export function kickSplinterPollChain(env: Env, executionCtx: WaitUntilContext): void {
  const url = splinterPollUrl(env);
  if (!url) {
    console.error(JSON.stringify({ event: 'splinter_poll_url_missing' }));
    return;
  }
  executionCtx.waitUntil(
    fetch(url, { method: 'POST' }).catch((error) => {
      console.error(
        JSON.stringify({
          event: 'splinter_poll_kick_failed',
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }),
  );
}

async function dismissPresenceMessage(env: Env, pending: PendingSplinterRun): Promise<void> {
  if (!pending.presenceMessageId) return;
  try {
    await deleteMessage(env, pending.chatId, pending.presenceMessageId);
  } catch {
    // already gone
  }
}

function scheduleNextPoll(env: Env, executionCtx: ExecutionContext): void {
  const url = splinterPollUrl(env);
  if (!url) return;
  executionCtx.waitUntil(
    sleep(POLL_INTERVAL_MS).then(() =>
      fetch(url, { method: 'POST' }).catch((error) => {
        console.error(
          JSON.stringify({
            event: 'splinter_poll_chain_failed',
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }),
    ),
  );
}

/**
 * One poll step: deliver when terminal, chain again when not.
 * Used by internal HTTP route, cron, and /master_splinter status.
 */
export async function pollSplinterRunOnce(
  env: Env,
  executionCtx?: ExecutionContext,
): Promise<boolean> {
  const pending = await loadPendingSplinterRun(env);
  if (!pending) return false;

  const ageMs = Date.now() - new Date(pending.createdAt).getTime();
  if (ageMs > MAX_RUN_AGE_MS) {
    await sendMessage(
      env,
      pending.chatId,
      [
        'My student, this run exceeded the dojo time limit.',
        `Send <code>${MASTER_SPLINTER_CMD} status</code> or start a shorter question.`,
      ].join('\n\n'),
      { parseMode: 'HTML' },
    );
    await dismissPresenceMessage(env, pending);
    await clearPendingSplinterRun(env);
    return true;
  }

  try {
    const run = await getRun(env, pending.agentId, pending.runId);
    if (!isTerminalRunStatus(run.status)) {
      if (executionCtx) scheduleNextPoll(env, executionCtx);
      return false;
    }

    const merged =
      pending.streamedText?.trim() && !run.result?.trim()
        ? { ...run, result: pending.streamedText }
        : run;

    await deliverRunReply(env, pending.chatId, merged);
    await dismissPresenceMessage(env, pending);
    await clearPendingSplinterRun(env);
    return true;
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'splinter_poll_error',
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    if (executionCtx) scheduleNextPoll(env, executionCtx);
    return false;
  }
}

/** Cron / status shortcut. */
export async function tryDeliverPendingSplinterRun(env: Env): Promise<boolean> {
  return pollSplinterRunOnce(env);
}
