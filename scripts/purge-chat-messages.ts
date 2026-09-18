/**
 * Best-effort purge of this bot's messages in a QA chat (never other members' lines).
 * Usage: TELEGRAM_BOT_TOKEN=... tsx scripts/purge-chat-messages.ts <chat_id> [scan_count] [thread_id]
 */
import { loadEnvFiles } from './load-env-file';

loadEnvFiles();

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN required');
  process.exit(1);
}

const chatId = Number(process.argv[2]);
const scanCount = Math.min(Number(process.argv[3] ?? '1200') || 1200, 5000);
const threadId = process.argv[4] ? Number(process.argv[4]) : undefined;

if (!Number.isFinite(chatId)) {
  console.error('Usage: tsx scripts/purge-chat-messages.ts <chat_id> [scan_count] [thread_id]');
  process.exit(1);
}

const api = `https://api.telegram.org/bot${token}`;

async function tg<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${api}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { ok: boolean; description?: string; result?: T };
  if (!data.ok) throw new Error(data.description ?? method);
  return data.result as T;
}

async function getBotId(): Promise<number> {
  const me = await tg<{ id: number }>('getMe', {});
  return me.id;
}

async function botCanDeleteOthers(chatId: number, botId: number): Promise<boolean> {
  try {
    const member = await tg<{ status: string; can_delete_messages?: boolean }>('getChatMember', {
      chat_id: chatId,
      user_id: botId,
    });
    return member.status === 'administrator' && Boolean(member.can_delete_messages);
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const botId = await getBotId();
  const canDeleteOthers = await botCanDeleteOthers(chatId, botId);

  const anchor = await tg<{ message_id: number }>('sendMessage', {
    chat_id: chatId,
    text: 'Purge anchor',
    ...(threadId ? { message_thread_id: threadId } : {}),
  });

  let deleted = 0;
  for (let id = anchor.message_id; id > anchor.message_id - scanCount; id--) {
    if (canDeleteOthers) {
      try {
        await tg('editMessageReplyMarkup', {
          chat_id: chatId,
          message_id: id,
          reply_markup: { inline_keyboard: [] },
          ...(threadId ? { message_thread_id: threadId } : {}),
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const lower = msg.toLowerCase();
        if (
          !lower.includes('message is not modified') &&
          !lower.includes("message can't be edited")
        ) {
          continue;
        }
      }
    }
    try {
      await tg('deleteMessage', {
        chat_id: chatId,
        message_id: id,
        ...(threadId ? { message_thread_id: threadId } : {}),
      });
      deleted++;
    } catch {
      // not our message
    }
  }

  console.log(`Deleted ${deleted} bot messages near anchor ${anchor.message_id} in chat ${chatId}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
