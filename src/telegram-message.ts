import type { TelegramMessage } from './types';

/** Plain text or media caption from a Telegram message. */
export function messageText(message: TelegramMessage): string {
  return (message.text ?? message.caption ?? '').trim();
}

/** Forum topic thread id when the message was sent inside a topic. */
export function messageThreadId(message: TelegramMessage): number | undefined {
  return message.message_thread_id;
}

export function sendThreadOptions(message: TelegramMessage): { messageThreadId?: number } {
  const thread = messageThreadId(message);
  return thread ? { messageThreadId: thread } : {};
}

/** Command token from a bot_command entity when present (handles odd clients). */
export function botCommandFromMessage(message: TelegramMessage): string | null {
  const text = message.text ?? '';
  if (!text) return null;
  for (const entity of message.entities ?? []) {
    if (entity.type === 'bot_command') {
      return text.slice(entity.offset, entity.offset + entity.length).trim();
    }
  }
  return null;
}

/** Text used for slash-command routing (entity-aware). */
export function commandRoutingText(message: TelegramMessage): string {
  const cmd = botCommandFromMessage(message);
  if (!cmd) return messageText(message);
  const body = messageText(message);
  if (!body) return cmd;
  if (body.startsWith(cmd)) return body;
  return `${cmd} ${body}`.trim();
}
