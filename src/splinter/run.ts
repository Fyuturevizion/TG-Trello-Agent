import {
  loadAgentSession,
  modelParamsForConfig,
  saveAgentSession,
  type AgentConfig,
} from './config';
import { createCloudAgent, followUpAgent, getAgent } from '../cursor-api';
import type { Env } from '../types';

export interface StartedCloudRun {
  agentId: string;
  runId: string;
  agentUrl?: string;
}

export async function startMasterSplinterRun(
  env: Env,
  config: AgentConfig,
  promptText: string,
  runName: string,
): Promise<StartedCloudRun> {
  const session = await loadAgentSession(env);

  if (session?.agentId) {
    try {
      const agent = await getAgent(env, session.agentId);
      if (agent.status === 'ACTIVE' || agent.status === 'CREATING') {
        const model = { id: config.modelId, params: modelParamsForConfig(config) };
        const { run } = await followUpAgent(env, session.agentId, promptText, model);
        return {
          agentId: session.agentId,
          runId: run.id,
          agentUrl: agent.url ?? session.agentUrl,
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
  };
}

export async function persistRunSession(
  env: Env,
  chatId: number,
  started: StartedCloudRun,
  lastPrompt: string,
): Promise<void> {
  const existing = await loadAgentSession(env);
  await saveAgentSession(env, {
    agentId: started.agentId,
    latestRunId: started.runId,
    agentUrl: started.agentUrl,
    notifyChatId: chatId,
    lastPrompt: lastPrompt.slice(0, 500),
    promptCount: (existing?.promptCount ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  });
}
