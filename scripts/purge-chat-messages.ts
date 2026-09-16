/**
 * Best-effort purge of recent messages in a QA chat (bot must be admin with delete rights).
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
const scanCount = Math.min(Number(process.argv[3] ?? '800') || 800, 5000);
const threadId = process.argv[4] ? Number(process.argv[4]) : undefined;

if (!Number.isFinite(chatId)) {
  console.error('Usage: tsx scripts/purge-chat-messages.ts <chat_id> [scan_count] [thread_id]');
  process.exit(1);
}

const api = `https://api.telegram.org/bot${token}`;

async function tg(method: string, body: Record<string, unknown>): Promise<{ ok: boolean }> {
  const res = await fetch(`${api}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await res.json()) as { ok: boolean };
}

async function main(): Promise<void> {
  const probeRes = await fetch(`${api}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: 'Purge anchor',
      ...(threadId ? { message_thread_id: threadId } : {}),
    }),
  });
  const probeJson = (await probeRes.json()) as { ok: boolean; result?: { message_id: number } };
  const anchor = probeJson.result?.message_id;
  if (!anchor) {
    console.error('No anchor message_id');
    process.exit(1);
  }

  let deleted = 0;
  for (let id = anchor; id > anchor - scanCount; id--) {
    const result = await tg('deleteMessage', {
      chat_id: chatId,
      message_id: id,
      ...(threadId ? { message_thread_id: threadId } : {}),
    });
    if (result.ok) deleted++;
  }

  console.log(`Deleted ${deleted} messages near anchor ${anchor} in chat ${chatId}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
