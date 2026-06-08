import {
  clearAgentSession,
  loadAgentConfig,
  loadAgentSession,
  saveAgentConfig,
  saveAgentSession,
  type AgentConfig,
} from './config';
import { cancelRun, getAgent, getRun, isTerminalRunStatus } from '../cursor-api';
import { parseAgentId } from '../cursor-client';
import { tryDeliverPendingSplinterRun } from './poll-delivery';
import { deliverRunReply, prepareSplinterReplyText } from './relay';
import { MASTER_SPLINTER_CMD } from './command';
import { escapeHtml, markdownToTelegramHtml } from '../telegram-format';
import { sendMessage } from '../telegram';
import type { Env } from '../types';

export async function handleMasterSplinterStatus(env: Env, chatId: number): Promise<void> {
  if (await tryDeliverPendingSplinterRun(env)) {
    return;
  }

  const session = await loadAgentSession(env);
  if (!session) {
    await sendMessage(env, chatId, `No session yet, my student. Use ${MASTER_SPLINTER_CMD} &lt;message&gt; to begin.`, {
      parseMode: 'HTML',
    });
    return;
  }

  try {
    const agent = await getAgent(env, session.agentId);
    const lines = [
      `Session: <code>${escapeHtml(agent.id)}</code>`,
      `Status: <i>${escapeHtml(agent.status ?? 'unknown')}</i>`,
    ];
    if (session.latestRunId) {
      const run = await getRun(env, session.agentId, session.latestRunId);
      if (isTerminalRunStatus(run.status)) {
        await deliverRunReply(env, chatId, run);
        return;
      }
      lines.push(`Last run: <i>${escapeHtml(run.status)}</i> (still in progress)`);
      lines.push(
        '',
        `When Cursor finishes, send <code>${MASTER_SPLINTER_CMD} status</code> again for my reply.`,
      );
    }
    await sendMessage(env, chatId, lines.join('\n'), { parseMode: 'HTML' });
  } catch (error) {
    await sendMessage(
      env,
      chatId,
      escapeHtml(error instanceof Error ? error.message : String(error)),
      { parseMode: 'HTML' },
    );
  }
}

export async function handleMasterSplinterLink(
  env: Env,
  chatId: number,
  linkArg: string,
): Promise<void> {
  const agentId = parseAgentId(linkArg);
  if (!agentId) {
    await sendMessage(
      env,
      chatId,
      `Usage: ${MASTER_SPLINTER_CMD} link bc-e720af1b-… (or paste a cursor.com/agents/bc-… URL)`,
    );
    return;
  }

  try {
    const agent = await getAgent(env, agentId);
    await saveAgentSession(env, {
      agentId,
      latestRunId: undefined,
      agentUrl: agent.url,
      notifyChatId: chatId,
      promptCount: 0,
      updatedAt: new Date().toISOString(),
    });

    let lastReply = '';
    const runId = agent.latestRunId;
    if (runId) {
      try {
        const run = await getRun(env, agentId, runId);
        if (run.result?.trim()) {
          const git = run.git?.branches?.[0];
          lastReply = prepareSplinterReplyText(run.result, git).slice(0, 2000);
        }
      } catch {
        // ignore
      }
    }

    const lines = [
      `<b>Linked.</b> Use <code>${MASTER_SPLINTER_CMD} &lt;message&gt;</code> in this channel, apprentice.`,
      `Session: <code>${escapeHtml(agentId)}</code>`,
    ];
    if (agent.name) lines.push(`Name: <i>${escapeHtml(agent.name)}</i>`);
    if (lastReply) lines.push('', markdownToTelegramHtml(lastReply));
    await sendMessage(env, chatId, lines.join('\n'), { parseMode: 'HTML' });
  } catch (error) {
    await sendMessage(
      env,
      chatId,
      escapeHtml(error instanceof Error ? error.message : String(error)),
      { parseMode: 'HTML' },
    );
  }
}

export async function handleMasterSplinterReset(env: Env, chatId: number): Promise<void> {
  await clearAgentSession(env);
  await sendMessage(env, chatId, `Session cleared, young one. Your next ${MASTER_SPLINTER_CMD} begins anew.`);
}

export async function handleMasterSplinterCancel(env: Env, chatId: number): Promise<void> {
  const session = await loadAgentSession(env);
  if (!session?.latestRunId) {
    await sendMessage(env, chatId, 'Nothing to cancel.');
    return;
  }
  try {
    await cancelRun(env, session.agentId, session.latestRunId);
    await sendMessage(env, chatId, 'Cancel requested for the active run.');
  } catch (error) {
    await sendMessage(
      env,
      chatId,
      escapeHtml(error instanceof Error ? error.message : String(error)),
      { parseMode: 'HTML' },
    );
  }
}

export async function handleMasterSplinterConfig(
  env: Env,
  chatId: number,
  cfgRest: string,
): Promise<void> {
  const config = await loadAgentConfig(env);

  if (!cfgRest) {
    await sendMessage(
      env,
      chatId,
      [
        '<b>Config</b>',
        `Repo: ${escapeHtml(config.repoUrl || '(not set)')}`,
        `Branch: ${escapeHtml(config.startingRef)}`,
        `Model: ${escapeHtml(config.modelId)}`,
        `Auto PR: ${config.autoCreatePR ? 'on' : 'off'}`,
        '',
        escapeHtml(config.systemInstructions.slice(0, 500)),
      ].join('\n'),
      { parseMode: 'HTML' },
    );
    return;
  }

  const [key, ...valueParts] = cfgRest.split(/\s+/);
  const value = valueParts.join(' ').trim();

  if (key === 'repo' && value) config.repoUrl = value;
  else if (key === 'branch' && value) config.startingRef = value;
  else if (key === 'model' && value) config.modelId = value;
  else if (key === 'pr' && (value === 'on' || value === 'off')) config.autoCreatePR = value === 'on';
  else if (key === 'instructions' && value) config.systemInstructions = value;
  else {
    await sendMessage(env, chatId, 'Unknown config key. Try: repo, branch, model, pr, instructions');
    return;
  }

  await saveAgentConfig(env, config);
  await sendMessage(env, chatId, `Updated config: <b>${escapeHtml(key)}</b>`, { parseMode: 'HTML' });
}

export async function ensureRepoConfigured(env: Env, chatId: number): Promise<AgentConfig | null> {
  const config = await loadAgentConfig(env);
  if (config.repoUrl) return config;

  await sendMessage(
    env,
    chatId,
    [
      'Set the GitHub repo first:',
      `${MASTER_SPLINTER_CMD} config repo https://github.com/your-org/TG-Trello-Agent`,
      '',
      'Or set CURSOR_AGENT_REPO_URL on the Worker.',
    ].join('\n'),
  );
  return null;
}
