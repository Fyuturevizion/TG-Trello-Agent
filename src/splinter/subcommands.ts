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
import {
  deliverLatestSessionRun,
  resumeSplinterPollChain,
  tryDeliverPendingSplinterRun,
} from './poll-delivery';
import { loadPendingSplinterRun } from './pending-run';
import { deliverRunReply, prepareSplinterReplyText } from './relay';
import { MASTER_SPLINTER_CMD } from './command';
import { escapeHtml, markdownToTelegramHtml } from '../telegram-format';
import { postChannelTriggersToChat } from '../channel';
import { addExtraQaChatId } from '../qa-chats';
import { getReportThreadId, setReportThreadId, TELEGRAM_GENERAL_TOPIC_ID } from '../qa-threads';
import { deleteMessage, sendMessage } from '../telegram';
import type { Env } from '../types';

function threadOpts(messageThreadId?: number) {
  return messageThreadId ? { messageThreadId } : {};
}

export async function handleMasterSplinterStatus(
  env: Env,
  chatId: number,
  executionCtx?: Pick<ExecutionContext, 'waitUntil'>,
  messageThreadId?: number,
): Promise<void> {
  const opts = threadOpts(messageThreadId);
  if (await tryDeliverPendingSplinterRun(env, executionCtx)) {
    return;
  }

  if (await deliverLatestSessionRun(env, chatId, messageThreadId)) {
    return;
  }

  const pending = await loadPendingSplinterRun(env);
  if (pending) {
    resumeSplinterPollChain(env, executionCtx);
    await sendMessage(
      env,
      chatId,
      [
        'My student, I am still working on your last request.',
        'I will post here when Cursor finishes — no need to send <code>/master_splinter status</code> repeatedly.',
      ].join('\n'),
      { parseMode: 'HTML', ...opts },
    );
    return;
  }

  const session = await loadAgentSession(env);
  if (!session) {
    await sendMessage(
      env,
      chatId,
      `No session yet, my student. Use ${MASTER_SPLINTER_CMD} &lt;message&gt; to begin.`,
      { parseMode: 'HTML', ...opts },
    );
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
        await deliverRunReply(env, chatId, run, messageThreadId);
        return;
      }
      lines.push(`Last run: <i>${escapeHtml(run.status)}</i> (still in progress)`);
      lines.push(
        '',
        `When Cursor finishes, send <code>${MASTER_SPLINTER_CMD} status</code> again for my reply.`,
      );
    }
    await sendMessage(env, chatId, lines.join('\n'), { parseMode: 'HTML', ...opts });
  } catch (error) {
    await sendMessage(
      env,
      chatId,
      escapeHtml(error instanceof Error ? error.message : String(error)),
      { parseMode: 'HTML', ...opts },
    );
  }
}

export async function handleMasterSplinterLink(
  env: Env,
  chatId: number,
  linkArg: string,
  messageThreadId?: number,
): Promise<void> {
  const opts = threadOpts(messageThreadId);
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
    await sendMessage(env, chatId, lines.join('\n'), { parseMode: 'HTML', ...opts });
  } catch (error) {
    await sendMessage(
      env,
      chatId,
      escapeHtml(error instanceof Error ? error.message : String(error)),
      { parseMode: 'HTML', ...opts },
    );
  }
}

export async function handleMasterSplinterReset(
  env: Env,
  chatId: number,
  messageThreadId?: number,
): Promise<void> {
  await clearAgentSession(env);
  await sendMessage(
    env,
    chatId,
    `Session cleared, young one. Your next ${MASTER_SPLINTER_CMD} begins anew.`,
    threadOpts(messageThreadId),
  );
}

export async function handleMasterSplinterCancel(
  env: Env,
  chatId: number,
  messageThreadId?: number,
): Promise<void> {
  const opts = threadOpts(messageThreadId);
  const session = await loadAgentSession(env);
  if (!session?.latestRunId) {
    await sendMessage(env, chatId, 'Nothing to cancel.', opts);
    return;
  }
  try {
    await cancelRun(env, session.agentId, session.latestRunId);
    await sendMessage(env, chatId, 'Cancel requested for the active run.', opts);
  } catch (error) {
    await sendMessage(
      env,
      chatId,
      escapeHtml(error instanceof Error ? error.message : String(error)),
      { parseMode: 'HTML', ...opts },
    );
  }
}

export async function handleMasterSplinterConfig(
  env: Env,
  chatId: number,
  cfgRest: string,
  messageThreadId?: number,
): Promise<void> {
  const opts = threadOpts(messageThreadId);
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
        `Fast mode: ${config.fastMode ? 'on' : 'off'}`,
        `Session limit: ${config.maxSessionPrompts} prompts`,
        '',
        escapeHtml(config.systemInstructions.slice(0, 500)),
      ].join('\n'),
      { parseMode: 'HTML', ...opts },
    );
    return;
  }

  const [key, ...valueParts] = cfgRest.split(/\s+/);
  const value = valueParts.join(' ').trim();

  if (key === 'repo' && value) config.repoUrl = value;
  else if (key === 'branch' && value) config.startingRef = value;
  else if (key === 'model' && value) config.modelId = value;
  else if (key === 'pr' && (value === 'on' || value === 'off')) config.autoCreatePR = value === 'on';
  else if (key === 'fast' && (value === 'on' || value === 'off')) config.fastMode = value === 'on';
  else if (key === 'session-limit' && value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 1) {
      await sendMessage(env, chatId, 'session-limit must be a positive number.', opts);
      return;
    }
    config.maxSessionPrompts = Math.floor(n);
  } else if (key === 'instructions' && value) config.systemInstructions = value;
  else {
    await sendMessage(
      env,
      chatId,
      'Unknown config key. Try: repo, branch, model, pr, fast, session-limit, instructions',
      opts,
    );
    return;
  }

  await saveAgentConfig(env, config);
  await sendMessage(env, chatId, `Updated config: <b>${escapeHtml(key)}</b>`, {
    parseMode: 'HTML',
    ...opts,
  });
}

/** Best-effort delete of recent messages in this chat (bot needs delete permission). */
export async function handleMasterSplinterPurgeChannel(
  env: Env,
  chatId: number,
  scanCountRaw: string | undefined,
  messageThreadId?: number,
): Promise<void> {
  const opts = threadOpts(messageThreadId);
  const scanCount = Math.min(Math.max(Number(scanCountRaw ?? '600') || 600, 50), 3000);

  const anchor = await sendMessage(env, chatId, '…', opts);
  let deleted = 0;
  for (let id = anchor.message_id; id > anchor.message_id - scanCount; id--) {
    try {
      await deleteMessage(env, chatId, id, messageThreadId);
      deleted++;
    } catch {
      // message missing or too old
    }
  }

  await sendMessage(
    env,
    chatId,
    `Cleared ${deleted} recent messages in this thread, my student. The dojo breathes again.`,
    opts,
  );
}

export async function handleSetReportTopic(
  env: Env,
  chatId: number,
  chatType: string,
  messageThreadId?: number,
): Promise<void> {
  const opts = threadOpts(messageThreadId);
  const allowedTypes = new Set(['group', 'supergroup', 'channel']);
  if (!allowedTypes.has(chatType)) {
    await sendMessage(
      env,
      chatId,
      'Run this inside your Operations Hub supergroup, in the <b>Bugs + reporting</b> topic.',
      { parseMode: 'HTML', ...opts },
    );
    return;
  }
  if (!messageThreadId || messageThreadId === TELEGRAM_GENERAL_TOPIC_ID) {
    await sendMessage(
      env,
      chatId,
      [
        'Open the <b>Bugs + reporting</b> topic first, then run:',
        '<code>/master_splinter set-report-topic</code>',
        '',
        'I will post triage cards and Splinter replies there instead of General.',
      ].join('\n'),
      { parseMode: 'HTML', ...opts },
    );
    return;
  }

  await setReportThreadId(env, chatId, messageThreadId);
  await postChannelTriggersToChat(env, chatId, messageThreadId);

  await sendMessage(
    env,
    chatId,
    [
      'Report topic saved for this hub.',
      `Chat ID: <code>${chatId}</code>`,
      `Topic ID: <code>${messageThreadId}</code>`,
      '',
      'New bug cards, Trello updates, and Splinter ops will land in this topic.',
    ].join('\n'),
    { parseMode: 'HTML', ...opts },
  );
}

export async function handleMasterSplinterAllowQa(
  env: Env,
  chatId: number,
  chatType: string,
  messageThreadId?: number,
): Promise<void> {
  const opts = threadOpts(messageThreadId);
  const allowedTypes = new Set(['group', 'supergroup', 'channel']);
  if (!allowedTypes.has(chatType)) {
    await sendMessage(
      env,
      chatId,
      'Run this from the QA group or channel you want to register, not in a private chat.',
      opts,
    );
    return;
  }

  const ids = await addExtraQaChatId(env, chatId);
  const reportThread =
    messageThreadId && messageThreadId !== TELEGRAM_GENERAL_TOPIC_ID
      ? messageThreadId
      : await getReportThreadId(env, chatId);

  if (messageThreadId && messageThreadId !== TELEGRAM_GENERAL_TOPIC_ID) {
    await setReportThreadId(env, chatId, messageThreadId);
  }

  await postChannelTriggersToChat(env, chatId, reportThread);

  const topicLine = reportThread
    ? `Report topic: <code>${reportThread}</code>`
    : 'Tip: run <code>/master_splinter set-report-topic</code> inside <b>Bugs + reporting</b> so cards do not land in General.';

  await sendMessage(
    env,
    chatId,
    [
      'This chat is now on the QA allowlist.',
      `Chat ID: <code>${chatId}</code>`,
      `Registered channels: ${ids.length}`,
      topicLine,
      '',
      'Pinned triage buttons are refreshed. Reporters can use /report here again.',
    ].join('\n'),
    { parseMode: 'HTML', ...opts },
  );
}

export async function ensureRepoConfigured(
  env: Env,
  chatId: number,
  messageThreadId?: number,
): Promise<AgentConfig | null> {
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
    threadOpts(messageThreadId),
  );
  return null;
}
