import { archiveAgent, type CursorRun, normalizeRunStatus } from '../cursor-api';
import { clearAgentSession, loadAgentConfig, loadAgentSession } from './config';
import { patchPendingSplinterRun, type PendingSplinterRun } from './pending-run';
import { streamPresenceWhileRunning } from './presence-stream';
import { SplinterPresence } from './presence';
import { persistRunSession, startMasterSplinterRun } from './run';
import type { Env } from '../types';

const FAST_EMPTY_ERROR_MS = 20_000;

/** Cursor follow-up runs often ERROR in ~1–2s with no result payload. */
export function isFastEmptyCursorError(run: CursorRun): boolean {
  return (
    normalizeRunStatus(run.status) === 'ERROR' &&
    !run.result?.trim() &&
    (run.durationMs ?? 0) < FAST_EMPTY_ERROR_MS
  );
}

type WaitUntilContext = Pick<ExecutionContext, 'waitUntil'>;

export interface SplinterRetryStarted {
  agentId: string;
  runId: string;
}

/**
 * Re-launch the same prompt on a fresh cloud agent when a follow-up run dies instantly.
 * Returns run ids when a retry was started (caller should not post the ERROR to Telegram).
 */
export async function retryPendingWithFreshAgent(
  env: Env,
  pending: PendingSplinterRun,
  executionCtx?: WaitUntilContext,
): Promise<SplinterRetryStarted | null> {
  if (!pending.promptText || pending.autoRetried) return null;

  const config = await loadAgentConfig(env);
  const priorSession = await loadAgentSession(env);
  if (priorSession?.agentId) {
    try {
      await archiveAgent(env, priorSession.agentId);
    } catch {
      // already archived
    }
  }
  await clearAgentSession(env);

  const started = await startMasterSplinterRun(
    env,
    config,
    pending.promptText,
    pending.runLabel ?? 'splinter-retry',
    true,
  );

  await persistRunSession(
    env,
    pending.chatId,
    started,
    pending.runLabel ?? 'splinter-retry',
    undefined,
  );

  await patchPendingSplinterRun(env, {
    agentId: started.agentId,
    runId: started.runId,
    autoRetried: true,
    streamedText: undefined,
    streamError: undefined,
    createdAt: new Date().toISOString(),
  });

  const presence = new SplinterPresence(
    env,
    pending.chatId,
    pending.messageThreadId,
    pending.presenceMessageId,
  );
  await presence.start();

  if (executionCtx) {
    executionCtx.waitUntil(
      streamPresenceWhileRunning(
        env,
        started.agentId,
        started.runId,
        presence,
        executionCtx,
      ),
    );
  }

  console.log(
    JSON.stringify({
      event: 'splinter_retry_fresh_agent',
      oldRunId: pending.runId,
      newRunId: started.runId,
      agentId: started.agentId,
    }),
  );

  return { agentId: started.agentId, runId: started.runId };
}
