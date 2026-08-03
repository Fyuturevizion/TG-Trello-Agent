import type { AgentConfig } from './config';
import { clearAgentSession, loadAgentSession } from './config';
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
import { supersedePendingSplinterRun } from './poll-delivery';
import { persistRunSession, startMasterSplinterRun } from './run';
import { archiveAgent } from '../cursor-api';
import { SplinterPresence } from './presence';
import {
  ensureRepoConfigured,
  handleMasterSplinterCancel,
  handleMasterSplinterConfig,
  handleMasterSplinterLink,
  handleMasterSplinterReset,
  handleMasterSplinterStatus,
} from './subcommands';
import { sendTestCardUpdate, sendTestReviewDm } from '../channel';
import { resolveBotUsername } from '../bot-identity';
import { commandRoutingText, messageText, messageThreadId } from '../telegram-message';
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

type ReplyTarget = { chatId: number; messageThreadId?: number };

function replyTarget(chatId: number, messageThreadId?: number): ReplyTarget {
  return messageThreadId ? { chatId, messageThreadId } : { chatId };
}

function threadOpts(target: ReplyTarget) {
  return target.messageThreadId ? { messageThreadId: target.messageThreadId } : {};
}

async function runMasterSplinterPrompt(
  env: Env,
  target: ReplyTarget,
  rest: string,
  executionCtx: { waitUntil: (p: Promise<unknown>) => void },
  userId?: number,
): Promise<void> {
  const chatId = target.chatId;
  const opts = threadOpts(target);
  if (!env.CURSOR_API_KEY?.trim()) {
    await sendMessage(
      env,
      chatId,
      'Cursor API is not configured. Add CURSOR_API_KEY as a Worker secret (Cursor Dashboard → Integrations).',
      opts,
    );
    return;
  }

  if (!rest || rest === 'help') {
    await sendMessage(env, chatId, masterSplinterHelpText(), { parseMode: 'HTML', ...opts });
    return;
  }

  if (rest === 'status') {
    await handleMasterSplinterStatus(env, chatId, executionCtx, target.messageThreadId);
    return;
  }

  if (rest.startsWith('link ')) {
    await handleMasterSplinterLink(env, chatId, rest.slice('link '.length), target.messageThreadId);
    return;
  }

  if (rest === 'reset') {
    await handleMasterSplinterReset(env, chatId, target.messageThreadId);
    return;
  }

  if (rest === 'cancel') {
    await handleMasterSplinterCancel(env, chatId, target.messageThreadId);
    return;
  }

  if (rest.startsWith('config')) {
    await handleMasterSplinterConfig(
      env,
      chatId,
      rest.slice('config'.length).trim(),
      target.messageThreadId,
    );
    return;
  }

  if (rest === 'test') {
    const posted = await sendTestCardUpdate(env);
    if (!posted) {
      await sendMessage(
        env,
        chatId,
        'Could not post test message. Check TELEGRAM_QA_CHAT_ID is set.',
        opts,
      );
      return;
    }
    await sendMessage(
      env,
      chatId,
      'Test card update posted to the QA channel. Tap <b>link to the card</b> there to confirm HTML links work.',
      { parseMode: 'HTML', ...opts },
    );
    return;
  }

  if (rest === 'test-dm' || rest === 'test dm') {
    if (!userId) return;
    try {
      await sendTestReviewDm(env, userId);
      await sendMessage(
        env,
        chatId,
        'Sample review DM sent to your private chat with the bot. Open our DM thread if you do not see it yet.',
        { parseMode: 'HTML', ...opts },
      );
    } catch (error) {
      await sendMessage(
        env,
        chatId,
        `Could not send test DM. Start a private chat with the bot first (tap Start), then try again.\n${escapeHtml(error instanceof Error ? error.message : String(error))}`,
        { parseMode: 'HTML', ...opts },
      );
    }
    return;
  }

  const forceNew = rest.startsWith('new ');
  const userPrompt = forceNew ? rest.slice('new '.length).trim() : rest;
  if (!userPrompt) {
    await sendMessage(env, chatId, masterSplinterHelpText(), { parseMode: 'HTML', ...opts });
    return;
  }

  const config = await ensureRepoConfigured(env, chatId, target.messageThreadId);
  if (!config) return;

  await supersedePendingSplinterRun(env);

  const priorSession = await loadAgentSession(env);
  const session = forceNew ? null : priorSession;
  const promptText = buildPrompt(config, userPrompt, Boolean(session?.agentId));

  const presence = new SplinterPresence(env, chatId, target.messageThreadId);
  await presence.start();

  try {
    if (forceNew && priorSession?.agentId) {
      try {
        await archiveAgent(env, priorSession.agentId);
      } catch {
        // ignore
      }
      await clearAgentSession(env);
    }

    const started = await startMasterSplinterRun(
      env,
      config,
      promptText,
      userPrompt.slice(0, 80),
      forceNew,
    );
    await persistRunSession(
      env,
      chatId,
      started,
      userPrompt,
      priorSession?.promptCount,
    );
    await savePendingSplinterRun(env, {
      agentId: started.agentId,
      runId: started.runId,
      chatId,
      messageThreadId: target.messageThreadId,
      createdAt: new Date().toISOString(),
      presenceMessageId: presence.getMessageId(),
    });
    kickSplinterPollChain(env, executionCtx);
    executionCtx.waitUntil(
      streamPresenceWhileRunning(env, started.agentId, started.runId, presence, executionCtx),
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
      { parseMode: 'HTML', ...opts },
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
      {
        parseMode: 'HTML',
        ...(messageThreadId(message) ? { messageThreadId: messageThreadId(message) } : {}),
      },
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
      { parseMode: 'HTML', ...(messageThreadId(message) ? { messageThreadId: messageThreadId(message) } : {}) },
    );
    return true;
  }

  await runMasterSplinterPrompt(
    env,
    replyTarget(chatId, messageThreadId(message)),
    rest,
    executionCtx,
    userId,
  );
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
  await runMasterSplinterPrompt(
    env,
    replyTarget(message.chat.id, messageThreadId(message)),
    rest,
    executionCtx,
    userId,
  );
  return true;
}

/** @deprecated Use handleMasterSplinterCommand */
export const handleAgentCommand = handleMasterSplinterCommand;
