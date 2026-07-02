import { streamAgentRun } from '../cursor-stream';
import { deliverPendingIfReady, resumeSplinterPollChain } from './poll-delivery';
import { loadPendingSplinterRun, patchPendingSplinterRun, pendingMatchesRun } from './pending-run';
import type { SplinterPresence } from './presence';
import type { Env } from '../types';

/** Keep streaming presence for the full run (not just the first 25s). */
const PRESENCE_STREAM_MS = 4 * 60 * 1000;

function toolCallDone(status: string): boolean {
  const s = status.toLowerCase();
  return s === 'completed' || s === 'complete' || s === 'finished' || s === 'done' || s === 'success';
}

function terminalStreamStatus(status: string): boolean {
  const s = status.toUpperCase();
  return s === 'FINISHED' || s === 'ERROR' || s === 'CANCELLED' || s === 'EXPIRED';
}

/**
 * Live meditation UI while Cursor runs. Delivers the reply as soon as the stream
 * or poll chain sees a terminal result.
 */
export async function streamPresenceWhileRunning(
  env: Env,
  agentId: string,
  runId: string,
  presence: SplinterPresence,
  executionCtx?: Pick<ExecutionContext, 'waitUntil'>,
): Promise<void> {
  const abort = AbortSignal.timeout(PRESENCE_STREAM_MS);
  let streamedText = '';

  const tryDeliver = async (): Promise<boolean> => {
    const delivered = await deliverPendingIfReady(env, agentId, runId);
    if (delivered) {
      await presence.finish();
    }
    return delivered;
  };

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
        if (terminalStreamStatus(event.status)) {
          await tryDeliver();
        }
      } else if (event.type === 'result') {
        streamedText = event.text?.trim() ?? '';
        if (streamedText) {
          await patchPendingSplinterRun(env, { streamedText });
        }
        if (terminalStreamStatus(event.status)) {
          await tryDeliver();
        }
      } else if (event.type === 'done') {
        await tryDeliver();
      }
    }, abort);
  } catch {
    // stream timeout is expected for long runs; poll chain continues
  }

  if (streamedText) {
    await patchPendingSplinterRun(env, { streamedText });
  }

  if (await tryDeliver()) {
    return;
  }

  resumeSplinterPollChain(env, executionCtx);

  const stillPending = await loadPendingSplinterRun(env);
  if (!pendingMatchesRun(stillPending, agentId, runId, presence.getMessageId() || undefined)) {
    await presence.finish();
  }
}
