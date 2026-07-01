import { streamAgentRun } from '../cursor-stream';
import { kickSplinterPollChain, pollSplinterRunOnce } from './poll-delivery';
import { loadPendingSplinterRun, patchPendingSplinterRun } from './pending-run';
import type { SplinterPresence } from './presence';
import type { Env } from '../types';

const PRESENCE_STREAM_MS = 25_000;

type WaitUntilContext = Pick<ExecutionContext, 'waitUntil'>;

function toolCallDone(status: string): boolean {
  const s = status.toLowerCase();
  return s === 'completed' || s === 'complete' || s === 'finished' || s === 'done' || s === 'success';
}

/**
 * Live meditation UI for the first ~25s of a run (within one waitUntil).
 * Final answer delivery is handled by the poll chain, not here.
 */
export async function streamPresenceWhileRunning(
  env: Env,
  agentId: string,
  runId: string,
  presence: SplinterPresence,
  executionCtx?: WaitUntilContext,
): Promise<void> {
  const abort = AbortSignal.timeout(PRESENCE_STREAM_MS);
  let streamedText = '';

  try {
    await streamAgentRun(env, agentId, runId, async (event) => {
      if (event.type === 'thinking') {
        presence.pushStream({ thinking: event.text });
      } else if (event.type === 'assistant') {
        presence.pushStream({ assistant: event.text });
      } else if (event.type === 'tool_call') {
        if (toolCallDone(event.status)) {
          presence.pushStream({ toolDone: true });
        } else {
          presence.pushStream({ toolName: event.name });
        }
      } else if (event.type === 'status') {
        presence.pushStream({ runStatus: event.status });
      } else if (event.type === 'result') {
        streamedText = event.text?.trim() ?? '';
      }
    }, abort);
  } catch {
    // stream timeout is expected; poll chain continues
  }

  if (streamedText) {
    await patchPendingSplinterRun(env, { streamedText });
  }

  const stillPending = await loadPendingSplinterRun(env);
  if (stillPending) {
    await presence.showPendingHint();
    if (executionCtx) {
      kickSplinterPollChain(env, executionCtx);
      executionCtx.waitUntil(
        pollSplinterRunOnce(env, executionCtx as ExecutionContext).catch(() => {}),
      );
    }
  }
}
