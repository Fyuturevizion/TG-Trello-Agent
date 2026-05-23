import {
  clearAgentSession,
  loadAgentConfig,
  loadAgentSession,
  saveAgentConfig,
  saveAgentSession,
  type AgentConfig,
} from './agent-config';
import {
  cancelRun,
  createCloudAgent,
  followUpAgent,
  getAgent,
  getRun,
  isTerminalRunStatus,
} from './cursor-api';
import { escapeHtml } from './telegram-format';
import { isAdminUser, normalizeCommand, sendMessage } from './telegram';
import type { Env, TelegramMessage } from './types';

const POLL_MS = 5000;
const MAX_POLLS = 72; // ~6 minutes
const MASTER_SPLINTER_CMD = '/master_splinter';

function isMasterSplinterCommand(firstToken: string): boolean {
  const cmd = normalizeCommand(firstToken);
  return cmd === MASTER_SPLINTER_CMD || cmd === '/master-splinter';
}

function buildPrompt(config: AgentConfig, userPrompt: string): string {
  return [config.systemInstructions, '', '---', '', 'Admin request (Telegram):', userPrompt].join(
    '\n',
  );
}

function helpText(): string {
  return [
    '<b>Master_Splinter — dojo maintainer (admin only)</b>',
    '',
    '<b>Run</b>',
    '/master-splinter &lt;prompt&gt; — ask Master_Splinter to change this repo',
    '/master-splinter status — last run status',
    '/master-splinter cancel — cancel active run',
    '/master-splinter reset — forget session (start fresh next time)',
    '',
    '<b>Config</b>',
    '/master-splinter config — show settings',
    '/master-splinter config repo &lt;github url&gt;',
    '/master-splinter config branch &lt;ref&gt;',
    '/master-splinter config model &lt;model id&gt;',
    '/master-splinter config pr on|off',
    '/master-splinter config instructions &lt;text&gt;',
  ].join('\n');
}

async function pollAndNotify(
  env: Env,
  chatId: number,
  agentId: string,
  runId: string,
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
        `Agent poll failed: ${escapeHtml(error instanceof Error ? error.message : String(error))}`,
        { parseMode: 'HTML' },
      );
      return;
    }

    if (!isTerminalRunStatus(run.status)) continue;

    const result = run.result?.trim();
    const summary =
      run.status === 'FINISHED'
        ? '<b>Master_Splinter finished</b>'
        : `<b>Master_Splinter ${escapeHtml(run.status)}</b>`;

    const text = [summary, result ? `\n\n${escapeHtml(result.slice(0, 3500))}` : ''].join('');
    await sendMessage(env, chatId, text, { parseMode: 'HTML' });
    return;
  }

  await sendMessage(
    env,
    chatId,
    ['<b>Master_Splinter still working</b>', 'Still shaping the code — hang tight.'].join('\n'),
    { parseMode: 'HTML' },
  );
}

export async function handleAgentCommand(
  env: Env,
  message: TelegramMessage,
  executionCtx: { waitUntil: (p: Promise<unknown>) => void },
): Promise<boolean> {
  const text = message.text?.trim() ?? '';
  const firstToken = text.split(/\s+/)[0] ?? '';
  if (!isMasterSplinterCommand(firstToken)) return false;

  const userId = message.from?.id;
  const chatId = message.chat.id;
  if (!userId) return true;

  const rest = text.slice(firstToken.length).trim();

  // Non-admins: silent — do not engage channel users at the dojo gate.
  if (!isAdminUser(env, userId)) return true;

  if (!env.CURSOR_API_KEY?.trim()) {
    await sendMessage(
      env,
      chatId,
      'Maintainer API is not configured on the Worker. Ask your ops lead to set CURSOR_API_KEY.',
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
      await sendMessage(env, chatId, 'No active session. Use /master-splinter &lt;prompt&gt; to start.', {
        parseMode: 'HTML',
      });
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
          `Status: ${escapeHtml(agent.status ?? 'unknown')}${runLine}`,
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
    await clearAgentSession(env);
    await sendMessage(env, chatId, 'Session cleared. Next /master-splinter will start fresh.');
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
          '<b>Agent config</b>',
          `Repo: ${escapeHtml(config.repoUrl || '(not set)')}`,
          `Branch: ${escapeHtml(config.startingRef)}`,
          `Model: ${escapeHtml(config.modelId)}`,
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
    else if (key === 'instructions' && value) config.systemInstructions = value;
    else {
      await sendMessage(env, chatId, 'Unknown config key. Try: repo, branch, model, pr, instructions');
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

  const promptText = buildPrompt(config, rest);
  const session = await loadAgentSession(env);

  try {
    let agentId: string;
    let runId: string;
    let agentUrl: string | undefined;

    if (session?.agentId) {
      try {
        const agent = await getAgent(env, session.agentId);
        if (agent.status === 'ACTIVE' || agent.status === 'CREATING') {
          const { run } = await followUpAgent(env, session.agentId, promptText, config.modelId);
          agentId = session.agentId;
          runId = run.id;
          agentUrl = agent.url ?? session.agentUrl;
        } else {
          throw new Error('agent_not_active');
        }
      } catch {
        const created = await createCloudAgent(env, {
          promptText,
          repoUrl: config.repoUrl,
          startingRef: config.startingRef,
          modelId: config.modelId,
          autoCreatePR: config.autoCreatePR,
          name: rest.slice(0, 80),
        });
        agentId = created.agent.id;
        runId = created.run.id;
        agentUrl = created.agent.url;
      }
    } else {
      const created = await createCloudAgent(env, {
        promptText,
        repoUrl: config.repoUrl,
        startingRef: config.startingRef,
        modelId: config.modelId,
        autoCreatePR: config.autoCreatePR,
        name: rest.slice(0, 80),
      });
      agentId = created.agent.id;
      runId = created.run.id;
      agentUrl = created.agent.url;
    }

    await saveAgentSession(env, {
      agentId,
      latestRunId: runId,
      agentUrl,
      notifyChatId: chatId,
      lastPrompt: rest.slice(0, 500),
      updatedAt: new Date().toISOString(),
    });

    await sendMessage(
      env,
      chatId,
      [`<b>Master_Splinter is on it</b>`, escapeHtml(rest.slice(0, 200))].join('\n'),
      { parseMode: 'HTML' },
    );

    executionCtx.waitUntil(pollAndNotify(env, chatId, agentId, runId));
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
