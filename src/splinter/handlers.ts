import type { AgentConfig } from './config';
import { loadAgentSession } from './config';
import { wrapTelegramUserMessage } from './prompts';
import { kickSplinterPollChain } from './poll-delivery';
import { streamPresenceWhileRunning } from './presence-stream';
import { TELEGRAM_OUTPUT_RULES } from './telegram-rules';
import { buildIntruderReply, recordIntruderAttempt } from './intruder';
import { masterSplinterHelpText } from './help';
import {
  MASTER_SPLINTER_CMD,
  isMasterSplinterCommand,
  parseMasterSplinterInvocation,
} from './command';
import { extractAdminSplinterPrompt, isAdminSplinterPing } from './admin-chat';
import { savePendingSplinterRun } from './pending-run';
import { persistRunSession, startMasterSplinterRun } from './run';
import { SplinterPresence } from './presence';
import {
  ensureRepoConfigured,
  handleMasterSplinterCancel,
  handleMasterSplinterConfig,
  handleMasterSplinterLink,
  handleMasterSplinterReset,
  handleMasterSplinterStatus,
} from './subcommands';
import { resolveBotUsername } from '../bot-identity';
import { commandRoutingText, messageText } from '../telegram-message';
import { escapeHtml } from '../telegram-format';
import { isAdminUser, sendMessage } from '../telegram';
import type { Env, TelegramMessage } from '../types';

function buildPrompt(config: AgentConfig, userPrompt: string, isFollowUp: boolean): string {
  const wrapped = wrapTelegramUserMessage(userPrompt);
  const parts = isFollowUp
    ? [wrapped]
    : [config.systemInstructions, '', '---', '', wrapped];
  parts.push('', TELEGRAM_OUTPUT_RULES);
  return parts.join('\n');
}

async function runMasterSplinterPrompt(
  env: Env,
  chatId: number,
  rest: string,
  executionCtx: { waitUntil: (p: Promise<unknown>) => void },
): Promise<void> {
  if (!env.CURSOR_API_KEY?.trim()) {
    await sendMessage(
      env,
      chatId,
      'Cursor API is not configured. Add CURSOR_API_KEY as a Worker secret (Cursor Dashboard → Integrations).',
    );
    return;
  }

  if (!rest || rest === 'help') {
    await sendMessage(env, chatId, masterSplinterHelpText(), { parseMode: 'HTML' });
    return;
  }

  if (rest === 'status') {
    await handleMasterSplinterStatus(env, chatId);
    return;
  }

  if (rest.startsWith('link ')) {
    await handleMasterSplinterLink(env, chatId, rest.slice('link '.length));
    return;
  }

  if (rest === 'reset') {
    await handleMasterSplinterReset(env, chatId);
    return;
  }

  if (rest === 'cancel') {
    await handleMasterSplinterCancel(env, chatId);
    return;
  }

  if (rest.startsWith('config')) {
    await handleMasterSplinterConfig(env, chatId, rest.slice('config'.length).trim());
    return;
  }

  const config = await ensureRepoConfigured(env, chatId);
  if (!config) return;

  const session = await loadAgentSession(env);
  const promptText = buildPrompt(config, rest, Boolean(session?.agentId));

  const presence = new SplinterPresence(env, chatId);
  await presence.start();

  try {
    const started = await startMasterSplinterRun(env, config, promptText, rest.slice(0, 80));
    await persistRunSession(env, chatId, started, rest);
    await savePendingSplinterRun(env, {
      agentId: started.agentId,
      runId: started.runId,
      chatId,
      createdAt: new Date().toISOString(),
      presenceMessageId: presence.getMessageId(),
    });
    kickSplinterPollChain(env, executionCtx);
    executionCtx.waitUntil(
      streamPresenceWhileRunning(env, started.agentId, started.runId, presence),
    );
  } catch (error) {
    await presence.finish();
    const raw = error instanceof Error ? error.message : String(error);
    const hint = raw.includes('Failed to verify existence of branch')
      ? [
          '',
          '<b>Fix:</b> Cursor cannot read this repo yet.',
          '1. Open cursor.com/dashboard → Integrations',
          '2. Connect GitHub and allow <b>Fyuturevizion/TG-Trello-Agent</b>',
          '3. Use an API key from that same Cursor account',
          `4. Retry ${MASTER_SPLINTER_CMD}`,
        ].join('\n')
      : '';
    await sendMessage(
      env,
      chatId,
      `My student, I could not begin: ${escapeHtml(raw)}${hint}`,
      { parseMode: 'HTML' },
    );
  }
}

export async function handleMasterSplinterCommand(
  env: Env,
  message: TelegramMessage,
  executionCtx: { waitUntil: (p: Promise<unknown>) => void },
): Promise<boolean> {
  const text = commandRoutingText(message);
  if (!isMasterSplinterCommand(text)) return false;

  const invocation = parseMasterSplinterInvocation(text);
  const userId = message.from?.id;
  const chatId = message.chat.id;
  if (!userId) return true;

  if (!invocation) {
    await sendMessage(
      env,
      chatId,
      `Could not read that command. Try <code>${MASTER_SPLINTER_CMD} help</code>.`,
      { parseMode: 'HTML' },
    );
    return true;
  }

  const rest = invocation.rest;

  if (!(await isAdminUser(env, userId))) {
    const record = await recordIntruderAttempt(env, userId, 'command');
    await sendMessage(
      env,
      chatId,
      buildIntruderReply(record, message.from?.username, message.from?.first_name, 'command'),
      { parseMode: 'HTML' },
    );
    return true;
  }

  await runMasterSplinterPrompt(env, chatId, rest, executionCtx);
  return true;
}

/** Admin ping without slash command (@master_splinter, @WLTH_Triage_Bot, "Master Splinter …"). */
export async function handleAdminSplinterChat(
  env: Env,
  message: TelegramMessage,
  executionCtx: { waitUntil: (p: Promise<unknown>) => void },
): Promise<boolean> {
  const userId = message.from?.id;
  if (!userId || !(await isAdminUser(env, userId))) return false;
  if (!isAdminSplinterPing(message, env)) return false;

  const rest = extractAdminSplinterPrompt(messageText(message), resolveBotUsername(env));
  await runMasterSplinterPrompt(env, message.chat.id, rest, executionCtx);
  return true;
}

/** @deprecated Use handleMasterSplinterCommand */
export const handleAgentCommand = handleMasterSplinterCommand;
