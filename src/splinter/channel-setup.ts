import { postChannelTriggersToChat } from '../channel';
import { addExtraQaChatId, getAllQaChatIds, isDojoChat, isQaChatAsync } from '../qa-chats';
import {
  getReportThreadId,
  setReportThreadId,
  TELEGRAM_GENERAL_TOPIC_ID,
} from '../qa-threads';
import { sendMessage } from '../telegram';
import type { Env } from '../types';

export type ChannelSetupAction = 'register' | 'refresh' | 'info';

function threadOpts(messageThreadId?: number) {
  return messageThreadId ? { messageThreadId } : {};
}

/** Admin asked Splinter to wire this group/channel for QA triage (not a Cursor code task). */
export function parseChannelSetupAction(rest: string): ChannelSetupAction | null {
  const raw = rest.trim();
  if (!raw) return null;

  const t = raw.toLowerCase().replace(/\s+/g, ' ');

  if (t.length > 320) return null;
  if (/\b(src\/|\.ts\b|\.tsx\b|pull request|refactor|implement|fix the code)\b/i.test(raw)) {
    return null;
  }

  if (
    t === 'allow-qa' ||
    t === 'allow qa' ||
    t === 'setup-channel' ||
    t === 'setup channel' ||
    t === 'register-channel' ||
    t === 'register channel'
  ) {
    return 'register';
  }

  if (
    t === 'refresh-buttons' ||
    t === 'refresh buttons' ||
    t === 'repin-buttons' ||
    t === 'repin buttons' ||
    t === 'pin-buttons' ||
    t === 'pin buttons'
  ) {
    return 'refresh';
  }

  if (
    t === 'channel-info' ||
    t === 'channel info' ||
    t === 'list-channels' ||
    t === 'list channels' ||
    t === 'show-channels' ||
    t === 'show channels' ||
    t === 'chatid' ||
    t === 'chat id'
  ) {
    return 'info';
  }

  const registerPhrases = [
    /\b(register|add)\b.{0,40}\b(channel|chat|group|here)\b/,
    /\b(set[- ]?up|configure|install)\b.{0,40}\b(channel|chat|triage|yourself|here)\b/,
    /\ballow\b.{0,20}\bqa\b/,
    /\b(enable|turn on)\b.{0,30}\btriage\b/,
    /\bpin\b.{0,30}\b(button|report)\b/,
    /\b(make|get)\b.{0,20}\b(this|here)\b.{0,30}\b(qa|triage)\b/,
    /\bset up\b.{0,10}\bhere\b/,
    /\bconfigure\b.{0,10}\b(this|here)\b/,
  ];
  if (registerPhrases.some((re) => re.test(t))) return 'register';

  const refreshPhrases = [
    /\b(refresh|repin|re-pin)\b.{0,30}\b(button|pinned|triage)\b/,
    /\bpost\b.{0,20}\b(button|keyboard)\b/,
  ];
  if (refreshPhrases.some((re) => re.test(t))) return 'refresh';

  const infoPhrases = [
    /\b(which|what)\b.{0,30}\bchannel(s)?\b.{0,20}\b(registered|qa)\b/,
    /\blist\b.{0,20}\b(qa|channel)/,
    /\bshow\b.{0,20}\bchat\s*id\b/,
    /\b(is|am)\b.{0,20}\b(this|here)\b.{0,20}\bregistered\b/,
  ];
  if (infoPhrases.some((re) => re.test(t))) return 'info';

  return null;
}

async function sendChannelInfo(
  env: Env,
  chatId: number,
  chatType: string,
  messageThreadId?: number,
): Promise<void> {
  const opts = { parseMode: 'HTML' as const, ...threadOpts(messageThreadId) };
  const ids = await getAllQaChatIds(env);
  const registered = await isQaChatAsync(env, chatId);
  const dojo = isDojoChat(env, chatId);
  const reportThread = await getReportThreadId(env, chatId);

  const lines = [
    '<b>Channel status</b>',
    `This chat: <code>${chatId}</code> (${escapeHtml(chatType)})`,
    `QA triage: ${registered ? 'yes' : 'no'}`,
    `Dojo (env): ${dojo ? 'yes' : 'no'}`,
    reportThread
      ? `Report topic: <code>${reportThread}</code>`
      : 'Report topic: not set (cards may land in General)',
    '',
    `Registered QA chats (${ids.length}):`,
    ids.length ? ids.map((id) => `• <code>${id}</code>`).join('\n') : '(none yet)',
    '',
    'To register this chat, say: <i>set up triage in this channel</i> or use <code>/master_splinter allow-qa</code>.',
  ];
  await sendMessage(env, chatId, lines.join('\n'), opts);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function handleSplinterChannelSetup(
  env: Env,
  chatId: number,
  chatType: string,
  action: ChannelSetupAction,
  messageThreadId?: number,
): Promise<void> {
  const opts = { parseMode: 'HTML' as const, ...threadOpts(messageThreadId) };
  const allowedTypes = new Set(['group', 'supergroup', 'channel']);

  if (action === 'info') {
    await sendChannelInfo(env, chatId, chatType, messageThreadId);
    return;
  }

  if (!allowedTypes.has(chatType)) {
    await sendMessage(
      env,
      chatId,
      'Channel setup runs in the group or channel you want reporters to use, not in a private chat with me.',
      opts,
    );
    return;
  }

  if (action === 'refresh') {
    const thread =
      messageThreadId && messageThreadId !== TELEGRAM_GENERAL_TOPIC_ID
        ? messageThreadId
        : await getReportThreadId(env, chatId);
    await postChannelTriggersToChat(env, chatId, thread);
    await sendMessage(
      env,
      chatId,
      [
        'I refreshed the triage buttons in this chat, my student.',
        `Chat ID: <code>${chatId}</code>`,
        'If pinning failed, make me an admin with pin rights.',
      ].join('\n'),
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

  await sendMessage(
    env,
    chatId,
    [
      'The dojo is open here. I registered this chat for WLTH QA triage.',
      `Chat ID: <code>${chatId}</code>`,
      `Registered QA channels: ${ids.length}`,
      reportThread
        ? `Report topic: <code>${reportThread}</code>`
        : 'Run <code>/master_splinter set-report-topic</code> inside <b>Bugs + reporting</b>.',
      '',
      'Pinned Report / Wishlist buttons are posted. Reporters may use /report, /bug, and /wishlist.',
      'I will announce new Trello cards here.',
      '',
      'Say <i>refresh the report buttons</i> if you need me to post them again.',
    ].join('\n'),
    opts,
  );
}
