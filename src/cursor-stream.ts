import { CURSOR_API_BASE, cursorAuthHeader } from './cursor-client';
import type { Env } from './types';

export type CursorStreamEvent =
  | { type: 'status'; status: string }
  | { type: 'thinking'; text: string }
  | { type: 'assistant'; text: string }
  | { type: 'tool_call'; name: string; status: string }
  | { type: 'result'; status: string; text?: string; durationMs?: number }
  | { type: 'error'; message: string }
  | { type: 'done' };

function parseSseBlock(block: string): CursorStreamEvent | null {
  let eventType = 'message';
  const dataLines: string[] = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) eventType = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  const raw = dataLines.join('\n');
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (eventType === 'thinking' && typeof data.text === 'string') {
    return { type: 'thinking', text: data.text };
  }
  if (eventType === 'assistant' && typeof data.text === 'string') {
    return { type: 'assistant', text: data.text };
  }
  if (eventType === 'tool_call' && typeof data.name === 'string') {
    return {
      type: 'tool_call',
      name: data.name,
      status: String(data.status ?? 'started'),
    };
  }
  if (eventType === 'status' && typeof data.status === 'string') {
    return { type: 'status', status: data.status };
  }
  if (eventType === 'result') {
    return {
      type: 'result',
      status: String(data.status ?? 'FINISHED'),
      text: typeof data.text === 'string' ? data.text : undefined,
      durationMs: typeof data.durationMs === 'number' ? data.durationMs : undefined,
    };
  }
  if (eventType === 'error') {
    return {
      type: 'error',
      message: String(data.message ?? data.code ?? 'stream error'),
    };
  }
  if (eventType === 'done') return { type: 'done' };
  return null;
}

/** Stream one run's SSE and invoke handler per parsed event. */
export async function streamAgentRun(
  env: Env,
  agentId: string,
  runId: string,
  onEvent: (event: CursorStreamEvent) => void | Promise<void>,
  signal?: AbortSignal,
): Promise<void> {
  const streamSignal = signal ?? AbortSignal.timeout(60_000);
  const res = await fetch(`${CURSOR_API_BASE}/v1/agents/${agentId}/runs/${runId}/stream`, {
    headers: {
      Authorization: cursorAuthHeader(env),
      Accept: 'text/event-stream',
    },
    signal: streamSignal,
  });

  if (!res.ok) {
    if (res.status === 410) throw new Error('stream_expired');
    const body = await res.text();
    throw new Error(`Cursor stream (${res.status}): ${body.slice(0, 300)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('Cursor stream: empty body');

  const decoder = new TextDecoder();
  let pending = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });

    let boundary = pending.indexOf('\n\n');
    while (boundary !== -1) {
      const block = pending.slice(0, boundary);
      pending = pending.slice(boundary + 2);
      const event = parseSseBlock(block);
      if (event) await onEvent(event);
      boundary = pending.indexOf('\n\n');
    }
  }

  if (pending.trim()) {
    const event = parseSseBlock(pending);
    if (event) await onEvent(event);
  }
}
