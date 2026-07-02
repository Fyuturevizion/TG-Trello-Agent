import { MASTER_SPLINTER_CMD } from './command';
import { loadAgentSession, saveAgentSession } from './config';
import {
  clearPendingSplinterRun,
  dismissPendingPresence,
  loadPendingSplinterRun,
  type PendingSplinterRun,
} from './pending-run';
import { deliverRunReply } from './relay';
import { cancelRun, getRun, isTerminalRunStatus } from '../cursor-api';
import { sendMessage } from '../telegram';
import type { Env } from '../types';

const POLL_INTERVAL_MS = 3000;
const MAX_RUN_AGE_MS = 45 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isAgentBusyError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('409') || msg.toLowerCase().includes('agent_busy');
}

export function splinterPollUrl(env: Env): string | null {
  const base = env.WEBAPP_URL?.trim().replace(/\/$/, '');
  const secret = env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!base || !secret) return null;
  return `${base}/internal/splinter-poll/${secret}`;
}

type WaitUntilContext = Pick<ExecutionContext, 'waitUntil'>;

function firePollRequest(env: Env): void {
  const url = splinterPollUrl(env);
  if (!url) return;
  void fetch(url, { method: 'POST' }).catch((error) => {
    console.error(
      JSON.stringify({
        event: 'splinter_poll_kick_failed',
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  });
}

async function markRunDelivered(env: Env, runId: string): Promise<void> {
  const session = await loadAgentSession(env);
  if (!session) return;
  await saveAgentSession(env, { ...session, lastDeliveredRunId: runId });
}

/** Post the reply when Cursor has finished; clear pending KV and presence line. */
export async function deliverPendingIfReady(
  env: Env,
  agentId?: string,
  runId?: string,
): Promise<boolean> {
  const pending = await loadPendingSplinterRun(env);
  if (!pending) return false;
  if (agentId && pending.agentId !== agentId) return false;
  if (runId && pending.runId !== runId) return false;

  try {
    const run = await getRun(env, pending.agentId, pending.runId);
    if (!isTerminalRunStatus(run.status)) return false;

    const merged =
      pending.streamedText?.trim() && !run.result?.trim()
        ? { ...run, result: pending.streamedText }
        : run;

    await deliverRunReply(env, pending.chatId, merged);
    await markRunDelivered(env, pending.runId);
    await dismissPendingPresence(env, pending);
    await clearPendingSplinterRun(env);
    return true;
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'splinter_deliver_pending_error',
        agentId: pending.agentId,
        runId: pending.runId,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return false;
  }
}

/** Deliver a finished run from session when pending KV was lost or superseded. */
export async function deliverLatestSessionRun(env: Env, chatId: number): Promise<boolean> {
  const session = await loadAgentSession(env);
  if (!session?.latestRunId || session.notifyChatId !== chatId) return false;
  if (session.lastDeliveredRunId === session.latestRunId) return false;

  try {
    const run = await getRun(env, session.agentId, session.latestRunId);
    if (!isTerminalRunStatus(run.status)) return false;
    await deliverRunReply(env, chatId, run);
    await saveAgentSession(env, { ...session, lastDeliveredRunId: session.latestRunId });
    return true;
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'splinter_deliver_session_error',
        agentId: session.agentId,
        runId: session.latestRunId,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return false;
  }
}

/**
 * Before starting a new Splinter prompt: deliver any finished reply we missed,
 * or cancel an in-flight run so follow-ups do not spawn duplicate agents.
 */
export async function supersedePendingSplinterRun(env: Env): Promise<void> {
  const pending = await loadPendingSplinterRun(env);
  if (!pending) return;

  if (await deliverPendingIfReady(env, pending.agentId, pending.runId)) {
    return;
  }

  try {
    const run = await getRun(env, pending.agentId, pending.runId);
    if (!isTerminalRunStatus(run.status)) {
      try {
        await cancelRun(env, pending.agentId, pending.runId);
      } catch {
        // already finished or cancelled
      }
    } else {
      await deliverPendingIfReady(env, pending.agentId, pending.runId);
      return;
    }
  } catch (error) {
    if (!isAgentBusyError(error)) {
      console.error(
        JSON.stringify({
          event: 'splinter_supersede_error',
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  await dismissPendingPresence(env, pending);
  await clearPendingSplinterRun(env);
}

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

/** Re-arm delivery when cron/status checks see a still-running agent. */
export function resumeSplinterPollChain(
  env: Env,
  executionCtx?: Pick<ExecutionContext, 'waitUntil'>,
): void {
  if (executionCtx) {
    kickSplinterPollChain(env, executionCtx);
  } else {
    firePollRequest(env);
  }
}

function scheduleNextPoll(env: Env, executionCtx: WaitUntilContext): void {
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

async function handleStalePending(env: Env, pending: PendingSplinterRun): Promise<boolean> {
  await sendMessage(
    env,
    pending.chatId,
    [
      'My student, this run exceeded the dojo time limit.',
      `Send <code>${MASTER_SPLINTER_CMD} status</code> or start a shorter question.`,
    ].join('\n\n'),
    { parseMode: 'HTML' },
  );
  await dismissPendingPresence(env, pending);
  await clearPendingSplinterRun(env);
  return true;
}

/**
 * One poll step: deliver when terminal, chain again when not.
 * Used by internal HTTP route, cron, and /master_splinter status.
 */
export async function pollSplinterRunOnce(
  env: Env,
  executionCtx?: WaitUntilContext,
): Promise<boolean> {
  const pending = await loadPendingSplinterRun(env);
  if (!pending) return false;

  const ageMs = Date.now() - new Date(pending.createdAt).getTime();
  if (ageMs > MAX_RUN_AGE_MS) {
    return handleStalePending(env, pending);
  }

  if (await deliverPendingIfReady(env, pending.agentId, pending.runId)) {
    return true;
  }

  if (executionCtx) {
    scheduleNextPoll(env, executionCtx);
  } else {
    firePollRequest(env);
  }
  return false;
}

/** Cron / status shortcut. */
export async function tryDeliverPendingSplinterRun(
  env: Env,
  executionCtx?: Pick<ExecutionContext, 'waitUntil'>,
): Promise<boolean> {
  if (await deliverPendingIfReady(env)) {
    return true;
  }

  const pending = await loadPendingSplinterRun(env);
  if (!pending) return false;

  const delivered = await pollSplinterRunOnce(env, executionCtx);
  if (!delivered && (await loadPendingSplinterRun(env))) {
    resumeSplinterPollChain(env, executionCtx);
  }
  return delivered;
}
