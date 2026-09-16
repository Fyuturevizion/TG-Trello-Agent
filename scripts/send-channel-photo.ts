/**
 * Send a local image file to a Telegram chat.
 * Usage: TELEGRAM_BOT_TOKEN=... tsx scripts/send-channel-photo.ts <chat_id> <file_path> [caption] [thread_id]
 */
import { readFileSync } from 'node:fs';
import { loadEnvFiles } from './load-env-file';

loadEnvFiles();

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN required');
  process.exit(1);
}

const chatId = process.argv[2];
const filePath = process.argv[3];
const caption = process.argv[4] ?? '';
const threadId = process.argv[5] ? Number(process.argv[5]) : undefined;

if (!chatId || !filePath) {
  console.error('Usage: tsx scripts/send-channel-photo.ts <chat_id> <file_path> [caption] [thread_id]');
  process.exit(1);
}

const api = `https://api.telegram.org/bot${token}/sendPhoto`;
const blob = new Blob([readFileSync(filePath)], { type: 'image/png' });
const form = new FormData();
form.append('chat_id', chatId);
form.append('photo', blob, 'splinter.png');
if (caption) form.append('caption', caption);
if (threadId) form.append('message_thread_id', String(threadId));

const res = await fetch(api, { method: 'POST', body: form });
const data = (await res.json()) as { ok: boolean; description?: string };
if (!data.ok) {
  console.error('sendPhoto failed:', data.description ?? res.statusText);
  process.exit(1);
}
console.log('Photo sent to chat', chatId);
