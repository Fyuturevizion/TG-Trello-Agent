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

export interface ModelParam {
  id: string;
  value: string;
}

function buildModelPayload(
  modelId: string,
  modelParams?: ModelParam[],
): { id: string; params?: ModelParam[] } {
  const params = modelParams?.filter((p) => p.id && p.value);
  if (params?.length) return { id: modelId, params };
  return { id: modelId };
}

export async function createCloudAgent(
  env: Env,
  input: {
    promptText: string;
    repoUrl: string;
    startingRef: string;
    modelId: string;
    modelParams?: ModelParam[];
    autoCreatePR: boolean;
    name?: string;
  },
): Promise<{ agent: CursorAgentSummary; run: CursorRun }> {
  return cursorFetch(env, '/v1/agents', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name?.slice(0, 100) ?? 'Master_Splinter, WLTH triage',
      prompt: { text: input.promptText },
      model: buildModelPayload(input.modelId, input.modelParams),
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
  model?: { id: string; params?: ModelParam[] },
): Promise<{ run: CursorRun }> {
  return cursorFetch(env, `/v1/agents/${agentId}/runs`, {
    method: 'POST',
    body: JSON.stringify({
      prompt: { text: promptText },
      ...(model ? { model: buildModelPayload(model.id, model.params) } : {}),
    }),
  });
}

export async function archiveAgent(env: Env, agentId: string): Promise<void> {
  await cursorFetch(env, `/v1/agents/${agentId}/archive`, { method: 'POST' });
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
  const normalized = status.trim().toUpperCase();
  return ['FINISHED', 'ERROR', 'CANCELLED', 'EXPIRED'].includes(normalized);
}
