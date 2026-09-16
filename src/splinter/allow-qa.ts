import { listQaChatIds } from '../qa-chats';
import { addExtraQaChatId } from '../qa-chats-kv';
import { sendMessage } from '../telegram';
import type { Env } from '../types';

export function isAllowQaIntent(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/^allow[\s-]?qa$/i.test(t)) return true;
  if (/^register[\s-]?qa$/i.test(t)) return true;
  if (/add\s+(this\s+)?(channel|chat|group|room)\s+to\s+qa/i.test(t)) return true;
  if (/make\s+(this\s+)?(channel|chat|group|room)\s+(a\s+)?qa(\s+channel)?/i.test(t)) return true;
  if (/register\s+(this\s+)?(channel|chat|group|room)\s+(as\s+)?qa/i.test(t)) return true;
  return false;
}

export async function handleAllowQa(
  env: Env,
  chatId: number,
  chatType: string,
  messageThreadId?: number,
): Promise<void> {
  const opts = messageThreadId ? { messageThreadId } : {};

  if (chatType === 'private') {
    await sendMessage(
      env,
      chatId,
      [
        'My student, I need to stand in the room you want on the dojo floor.',
        'Send <code>/master_splinter allow-qa</code> from that group or channel, or say “add this channel to QA” there.',
      ].join('\n'),
      { parseMode: 'HTML', ...opts },
    );
    return;
  }

  if (chatType !== 'group' && chatType !== 'supergroup' && chatType !== 'channel') {
    await sendMessage(
      env,
      chatId,
      'This chat type cannot be registered as QA. Use a group, supergroup, or channel.',
      opts,
    );
    return;
  }

  const before = await listQaChatIds(env);
  if (before.includes(chatId)) {
    await sendMessage(
      env,
      chatId,
      [
        'This chat was already on the QA list, young one.',
        `Chat ID: <code>${chatId}</code>`,
        '<code>/report</code> and Trello updates already flow here.',
      ].join('\n'),
      { parseMode: 'HTML', ...opts },
    );
    return;
  }

  await addExtraQaChatId(env, chatId);
  const allIds = await listQaChatIds(env);

  {
    await sendMessage(
      env,
      chatId,
      [
        'It is done, apprentice. I remembered this chat in KV and merged it with the QA list.',
        `Chat ID: <code>${chatId}</code>`,
        'Trello announcements, card updates, and <code>/report</code> work here like your first dojo floor.',
        'Run <code>/setup</code> when you want fresh pinned buttons in this room.',
        '',
        `QA channels now (${allIds.length}): ${allIds.map((id) => `<code>${id}</code>`).join(', ')}`,
      ].join('\n'),
      { parseMode: 'HTML', ...opts },
    );
  }
}
