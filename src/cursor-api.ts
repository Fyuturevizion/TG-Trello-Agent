import { cursorFetch } from './cursor-client';
import type { Env } from './types';

export type CursorRunStatus =
  | 'CREATING'
  | 'RUNNING'
  | 'FINISHED'
  | 'ERROR'
  | 'CANCELLED'
  | 'EXPIRED'
  | string;

export interface CursorAgentSummary {
  id: string;
  name?: string;
  status?: string;
  url?: string;
  latestRunId?: string;
}

export interface CursorGitBranch {
  repoUrl?: string;
  branch?: string;
  prUrl?: string;
}

export interface CursorRun {
  id: string;
  agentId: string;
  status: CursorRunStatus;
  result?: string;
  durationMs?: number;
  git?: { branches?: CursorGitBranch[] };
}

export { parseAgentId } from './cursor-client';

export async function createCloudAgent(
  env: Env,
  input: {
    promptText: string;
    repoUrl: string;
    startingRef: string;
    modelId: string;
    autoCreatePR: boolean;
    name?: string;
  },
): Promise<{ agent: CursorAgentSummary; run: CursorRun }> {
  return cursorFetch(env, '/v1/agents', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name?.slice(0, 100) ?? 'Master_Splinter, WLTH triage',
      prompt: { text: input.promptText },
      model: { id: input.modelId },
      repos: [{ url: input.repoUrl, startingRef: input.startingRef }],
      autoCreatePR: input.autoCreatePR,
      skipReviewerRequest: true,
    }),
  });
}

export async function followUpAgent(
  env: Env,
  agentId: string,
  promptText: string,
  modelId?: string,
): Promise<{ run: CursorRun }> {
  return cursorFetch(env, `/v1/agents/${agentId}/runs`, {
    method: 'POST',
    body: JSON.stringify({
      prompt: { text: promptText },
      ...(modelId ? { model: { id: modelId } } : {}),
    }),
  });
}

export async function getAgent(env: Env, agentId: string): Promise<CursorAgentSummary> {
  return cursorFetch(env, `/v1/agents/${agentId}`);
}

export async function getRun(env: Env, agentId: string, runId: string): Promise<CursorRun> {
  return cursorFetch(env, `/v1/agents/${agentId}/runs/${runId}`);
}

export async function cancelRun(env: Env, agentId: string, runId: string): Promise<void> {
  await cursorFetch(env, `/v1/agents/${agentId}/runs/${runId}/cancel`, { method: 'POST' });
}

export function isTerminalRunStatus(status: string): boolean {
  return ['FINISHED', 'ERROR', 'CANCELLED', 'EXPIRED'].includes(status);
}
