import {
  clearAgentSession,
  loadAgentConfig,
  loadAgentSession,
  modelParamsForConfig,
  saveAgentConfig,
  saveAgentSession,
  type AgentConfig,
} from './agent-config';
import {
  archiveAgent,
  cancelRun,
  createCloudAgent,
  followUpAgent,
  getAgent,
  getRun,
  isTerminalRunStatus,
} from './cursor-api';
import { buildIntruderReply, recordIntruderAttempt } from './agent-intruder';
import { escapeHtml } from './telegram-format';
import { isAdminUser, isBlockedUser, normalizeCommand, sendMessage } from './telegram';
import type { Env, TelegramMessage } from './types';

const POLL_MS = 5000;
const MAX_POLLS = 240; // ~20 minutes
const PROGRESS_EVERY_POLLS = 24; // ~2 minutes

const SPLINTER_COMMANDS = new Set(['/master-splinter', '/master_splinter', '/agent']);

function isSplinterCommand(text: string): boolean {
  const firstToken = text.split(/\s+/)[0] ?? '';
  return SPLINTER_COMMANDS.has(normalizeCommand(firstToken));
}

function splinterCommandPrefix(text: string): string {
  const firstToken = text.split(/\s+/)[0] ?? '';
  return normalizeCommand(firstToken);
}

function buildPrompt(config: AgentConfig, userPrompt: string): string {
  return [config.systemInstructions, '', '---', '', 'Admin request (Telegram):', userPrompt].join(
    '\n',
  );
}

function helpText(): string {
  return [
    '<b>WLTH Triage — Master_Splinter (admin only)</b>',
    '',
    '<b>Run</b>',
    '/master-splinter &lt;prompt&gt; — ask me to change this repo',
    '/master-splinter status — last run status',
    '/master-splinter cancel — cancel active run',
    '/master-splinter reset — forget session (fresh context next time)',
    '/master-splinter new &lt;prompt&gt; — force a new session',
    '',
    '<b>Config</b>',
    '/master-splinter config — show settings',
    '/master-splinter config repo &lt;github url&gt;',
    '/master-splinter config branch &lt;ref&gt;',
    '/master-splinter config model &lt;model id&gt;',
    '/master-splinter config pr on|off',
    '/master-splinter config fast on|off',
    '/master-splinter config session-limit &lt;n&gt;',
    '/master-splinter config instructions &lt;text&gt;',
  ].join('\n');
}

async function pollAndNotify(
  env: Env,
  chatId: number,
  agentId: string,
  runId: string,
  agentUrl?: string,
): Promise<void> {
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    let run;
    try {
      run = await getRun(env, agentId, runId);
    } catch (error) {
      await sendMessage(
        env,
        chatId,
        `Poll failed: ${escapeHtml(error instanceof Error ? error.message : String(error))}`,
        { parseMode: 'HTML' },
      );
      return;
    }

    if (!isTerminalRunStatus(run.status)) {
      if (i > 0 && i % PROGRESS_EVERY_POLLS === 0) {
        await sendMessage(
          env,
          chatId,
          `<b>Still working</b> (${Math.round((i * POLL_MS) / 60000)} min). Reasoning and edits can take a while on larger tasks.`,
          { parseMode: 'HTML' },
        );
      }
      continue;
    }

    const link = agentUrl ? `\n${escapeHtml(agentUrl)}` : '';
    const result = run.result?.trim();
    const summary =
      run.status === 'FINISHED'
        ? '<b>Finished</b>'
        : `<b>Run ${escapeHtml(run.status)}</b>`;

    const text = [
      summary,
      result ? `\n\n${escapeHtml(result.slice(0, 3500))}` : '',
      link,
    ].join('');
    await sendMessage(env, chatId, text, { parseMode: 'HTML' });
    return;
  }

  const session = await loadAgentSession(env);
  const link = session?.agentUrl ?? agentUrl;
  await sendMessage(
    env,
    chatId,
    [
      '<b>Still running after 20 minutes</b>',
      'I stopped watching here, but the job may still be going.',
      link ? escapeHtml(link) : '(no link)',
      '',
      'Try /master-splinter status, or /master-splinter reset if context feels stuck.',
    ].join('\n'),
    { parseMode: 'HTML' },
  );
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

async function startRun(
  env: Env,
  config: AgentConfig,
  promptText: string,
  nameHint: string,
  forceNew: boolean,
): Promise<{ agentId: string; runId: string; agentUrl?: string; freshSession: boolean }> {
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
      // Fall through to create a new agent.
    }
  }

  const created = await createCloudAgent(env, {
    promptText,
    repoUrl: config.repoUrl,
    startingRef: config.startingRef,
    modelId: config.modelId,
    modelParams: model.params,
    autoCreatePR: config.autoCreatePR,
    name: nameHint,
  });
  return {
    agentId: created.agent.id,
    runId: created.run.id,
    agentUrl: created.agent.url,
    freshSession: true,
  };
}

export async function handleAgentCommand(
  env: Env,
  message: TelegramMessage,
  executionCtx: { waitUntil: (p: Promise<unknown>) => void },
): Promise<boolean> {
  const text = message.text?.trim() ?? '';
  if (!isSplinterCommand(text)) return false;

  const prefix = splinterCommandPrefix(text);
  const userId = message.from?.id;
  const chatId = message.chat.id;
  if (!userId) return true;

  const rest = text.slice(prefix.length).trim();

  if (!isAdminUser(env, userId)) {
    if (isBlockedUser(env, userId, message.from?.username)) {
      await sendMessage(env, chatId, 'You are not permitted to use this bot.');
      return true;
    }
    const record = await recordIntruderAttempt(env, userId);
    await sendMessage(
      env,
      chatId,
      buildIntruderReply(record, message.from?.username, message.from?.first_name),
      { parseMode: 'HTML' },
    );
    return true;
  }

  if (!env.CURSOR_API_KEY?.trim()) {
    await sendMessage(
      env,
      chatId,
      'Cursor API is not configured. Add CURSOR_API_KEY as a Worker secret (Cursor Dashboard → Integrations).',
    );
    return true;
  }

  if (!rest || rest === 'help') {
    await sendMessage(env, chatId, helpText(), { parseMode: 'HTML' });
    return true;
  }

  if (rest === 'status') {
    const session = await loadAgentSession(env);
    if (!session) {
      await sendMessage(
        env,
        chatId,
        'No active session. Use /master-splinter &lt;prompt&gt; to start.',
        { parseMode: 'HTML' },
      );
      return true;
    }
    try {
      const agent = await getAgent(env, session.agentId);
      let runLine = '';
      if (session.latestRunId) {
        const run = await getRun(env, session.agentId, session.latestRunId);
        runLine = `\nRun: ${escapeHtml(run.status)}`;
        if (run.result && isTerminalRunStatus(run.status)) {
          runLine += `\n\n${escapeHtml(run.result.slice(0, 2000))}`;
        }
      }
      await sendMessage(
        env,
        chatId,
        [
          `<b>Session</b> ${escapeHtml(agent.id)}`,
          `Prompts in session: ${session.promptCount ?? 0}`,
          `Status: ${escapeHtml(agent.status ?? 'unknown')}${runLine}`,
          agent.url ? escapeHtml(agent.url) : '',
        ].join('\n'),
        { parseMode: 'HTML' },
      );
    } catch (error) {
      await sendMessage(
        env,
        chatId,
        escapeHtml(error instanceof Error ? error.message : String(error)),
        { parseMode: 'HTML' },
      );
    }
    return true;
  }

  if (rest === 'reset') {
    await archiveSessionAgent(env);
    await clearAgentSession(env);
    await sendMessage(
      env,
      chatId,
      'Session cleared. Next /master-splinter starts with a fresh context window.',
    );
    return true;
  }

  if (rest === 'cancel') {
    const session = await loadAgentSession(env);
    if (!session?.latestRunId) {
      await sendMessage(env, chatId, 'Nothing to cancel.');
      return true;
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
    return true;
  }

  if (rest.startsWith('config')) {
    const config = await loadAgentConfig(env);
    const cfgRest = rest.slice('config'.length).trim();

    if (!cfgRest) {
      await sendMessage(
        env,
        chatId,
        [
          '<b>Master_Splinter config</b>',
          `Repo: ${escapeHtml(config.repoUrl || '(not set)')}`,
          `Branch: ${escapeHtml(config.startingRef)}`,
          `Model: ${escapeHtml(config.modelId)}`,
          `Fast mode: ${config.fastMode ? 'on' : 'off'}`,
          `Session limit: ${config.maxSessionPrompts} prompts`,
          `Auto PR: ${config.autoCreatePR ? 'on' : 'off'}`,
          '',
          escapeHtml(config.systemInstructions.slice(0, 500)),
        ].join('\n'),
        { parseMode: 'HTML' },
      );
      return true;
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
        await sendMessage(env, chatId, 'session-limit must be a positive number.');
        return true;
      }
      config.maxSessionPrompts = Math.floor(n);
    } else if (key === 'instructions' && value) config.systemInstructions = value;
    else {
      await sendMessage(
        env,
        chatId,
        'Unknown config key. Try: repo, branch, model, pr, fast, session-limit, instructions',
      );
      return true;
    }

    await saveAgentConfig(env, config);
    await sendMessage(env, chatId, `Updated config: <b>${escapeHtml(key)}</b>`, { parseMode: 'HTML' });
    return true;
  }

  const config = await loadAgentConfig(env);
  if (!config.repoUrl) {
    await sendMessage(
      env,
      chatId,
      [
        'Set the GitHub repo first:',
        '/master-splinter config repo https://github.com/your-org/TG-Trello-Agent',
        '',
        'Or set CURSOR_AGENT_REPO_URL on the Worker.',
      ].join('\n'),
    );
    return true;
  }

  const forceNew = rest.startsWith('new ');
  const userPrompt = forceNew ? rest.slice('new '.length).trim() : rest;
  if (!userPrompt) {
    await sendMessage(env, chatId, helpText(), { parseMode: 'HTML' });
    return true;
  }

  const promptText = buildPrompt(config, userPrompt);
  const priorSession = await loadAgentSession(env);

  try {
    if (forceNew) {
      await archiveSessionAgent(env);
      await clearAgentSession(env);
    }

    const { agentId, runId, agentUrl, freshSession } = await startRun(
      env,
      config,
      promptText,
      userPrompt.slice(0, 80),
      forceNew,
    );

    const promptCount = freshSession ? 1 : (priorSession?.promptCount ?? 0) + 1;

    await saveAgentSession(env, {
      agentId,
      latestRunId: runId,
      agentUrl,
      notifyChatId: chatId,
      lastPrompt: userPrompt.slice(0, 500),
      promptCount,
      updatedAt: new Date().toISOString(),
    });

    const freshNote = freshSession && !forceNew && priorSession ? '\n<i>Started fresh session (context limit reached).</i>' : '';
    const link = agentUrl ? `\n${agentUrl}` : '';
    await sendMessage(
      env,
      chatId,
      [
        `<b>On it</b>${freshNote}`,
        escapeHtml(userPrompt.slice(0, 200)),
        link,
      ].join('\n'),
      { parseMode: 'HTML' },
    );

    executionCtx.waitUntil(pollAndNotify(env, chatId, agentId, runId, agentUrl));
  } catch (error) {
    await sendMessage(
      env,
      chatId,
      `Failed to start: ${escapeHtml(error instanceof Error ? error.message : String(error))}`,
      { parseMode: 'HTML' },
    );
  }

  return true;
}
