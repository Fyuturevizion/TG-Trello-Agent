import {
  loadAgentSession,
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
        const { run } = await followUpAgent(env, session.agentId, promptText, config.modelId);
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
  await saveAgentSession(env, {
    agentId: started.agentId,
    latestRunId: started.runId,
    agentUrl: started.agentUrl,
    notifyChatId: chatId,
    lastPrompt: lastPrompt.slice(0, 500),
    updatedAt: new Date().toISOString(),
  });
}
