import {
  clearAgentSession,
  loadAgentSession,
  modelParamsForConfig,
  saveAgentSession,
  type AgentConfig,
} from './config';
import { archiveAgent, createCloudAgent, followUpAgent, getAgent } from '../cursor-api';
import type { Env } from '../types';

export interface StartedCloudRun {
  agentId: string;
  runId: string;
  agentUrl?: string;
  freshSession: boolean;
}

async function archiveSessionAgent(env: Env): Promise<void> {
  const session = await loadAgentSession(env);
  if (!session?.agentId) return;
  try {
    await archiveAgent(env, session.agentId);
  } catch {
    // Agent may already be archived or deleted.
  }
}

export async function startMasterSplinterRun(
  env: Env,
  config: AgentConfig,
  promptText: string,
  runName: string,
  forceNew = false,
): Promise<StartedCloudRun> {
  const model = { id: config.modelId, params: modelParamsForConfig(config) };
  let session = forceNew ? null : await loadAgentSession(env);

  if (
    session?.agentId &&
    (session.promptCount ?? 0) >= config.maxSessionPrompts
  ) {
    await archiveSessionAgent(env);
    await clearAgentSession(env);
    session = null;
  }

  if (session?.agentId) {
    try {
      const agent = await getAgent(env, session.agentId);
      if (agent.status === 'ACTIVE' || agent.status === 'CREATING') {
        const { run } = await followUpAgent(env, session.agentId, promptText, model);
        return {
          agentId: session.agentId,
          runId: run.id,
          agentUrl: agent.url ?? session.agentUrl,
          freshSession: false,
        };
      }
    } catch {
      // fall through to new agent
    }
  }

  const created = await createCloudAgent(env, {
    promptText,
    repoUrl: config.repoUrl,
    startingRef: config.startingRef,
    modelId: config.modelId,
    modelParams: modelParamsForConfig(config),
    autoCreatePR: config.autoCreatePR,
    name: runName,
  });

  return {
    agentId: created.agent.id,
    runId: created.run.id,
    agentUrl: created.agent.url,
    freshSession: true,
  };
}

export async function persistRunSession(
  env: Env,
  chatId: number,
  started: StartedCloudRun,
  lastPrompt: string,
  priorPromptCount?: number,
): Promise<void> {
  const promptCount = started.freshSession
    ? 1
    : (priorPromptCount ?? (await loadAgentSession(env))?.promptCount ?? 0) + 1;

  await saveAgentSession(env, {
    agentId: started.agentId,
    latestRunId: started.runId,
    agentUrl: started.agentUrl,
    notifyChatId: chatId,
    lastPrompt: lastPrompt.slice(0, 500),
    promptCount,
    updatedAt: new Date().toISOString(),
  });
}
