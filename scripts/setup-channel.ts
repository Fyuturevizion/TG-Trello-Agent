/**
 * Post pinned channel triggers. Prefers web_app buttons when domain is registered in BotFather.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { channelStartAppKeyboard } from '../src/channel';
import { webappUrlWithVersion } from '../src/webapp-version';

const BOT_USERNAME = 'WLTH_Triage_Bot';

function loadEnv(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const name of ['.dev.vars', '.env']) {
    const path = resolve(process.cwd(), name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      vars[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
  }
  return vars;
}

async function api(token: string, method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { ok: boolean; description?: string; result?: { message_id: number } };
  if (!data.ok) throw new Error(data.description ?? method);
  return data.result;
}

async function main(): Promise<void> {
  const env = { ...loadEnv(), ...process.env };
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_QA_CHAT_ID;
  if (!token || !chatId) throw new Error('Need TELEGRAM_BOT_TOKEN and TELEGRAM_QA_CHAT_ID');

  const me = await fetch(`https://api.telegram.org/bot${token}/getMe`).then((r) => r.json()) as {
    result?: { has_main_web_app?: boolean };
  };
  const hasMain = me.result?.has_main_web_app === true;

  const text = [
    'WLTH QA Triage',
    '',
    hasMain
      ? 'Tap a button to open the report form in Telegram.'
      : [
          'Channel buttons need BotFather setup (see README).',
          'Until then: open @WLTH_Triage_Bot → tap Menu → Report to Trello.',
        ].join('\n'),
    '',
    'One announcement here when a card is submitted.',
  ].join('\n');

  const base = (env.WEBAPP_URL ?? '').replace(/\/$/, '');
  const fallbackKeyboard = {
    inline_keyboard: [[{ text: 'Open @WLTH_Triage_Bot', url: `https://t.me/${BOT_USERNAME}` }]],
  };

  const reply_markup = hasMain ? channelStartAppKeyboard() : fallbackKeyboard;

  const sent = await api(token, 'sendMessage', {
    chat_id: Number(chatId),
    text,
    reply_markup,
  });

  if (sent?.message_id) {
    try {
      await api(token, 'pinChatMessage', {
        chat_id: Number(chatId),
        message_id: sent.message_id,
        disable_notification: true,
      });
      console.log('Pinned message', sent.message_id);
    } catch (e) {
      console.warn('Could not pin:', e);
    }
  }

  console.log('Posted to', chatId, hasMain ? '(startapp buttons)' : '(use bot Menu until BotFather setup)');
  if (hasMain && base) {
    const miniAppUrl = webappUrlWithVersion(base);
    console.log('\nIMPORTANT — set this exact URL in @BotFather → Configure Mini App:');
    console.log(miniAppUrl);
    console.log('Then force-quit Telegram and use Menu → Report to Trello (or new pinned buttons).');
  }
  if (!hasMain) {
    console.log('\nRun: npm run check:webapp — for BotFather steps');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
