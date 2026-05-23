/**
 * Check whether the bot is ready to open the Mini App from Telegram.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

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

async function main(): Promise<void> {
  const token = loadEnv().TELEGRAM_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN missing');

  const me = await fetch(`https://api.telegram.org/bot${token}/getMe`).then((r) => r.json()) as {
    result?: { username?: string; has_main_web_app?: boolean };
  };

  const menu = await fetch(`https://api.telegram.org/bot${token}/getChatMenuButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  }).then((r) => r.json()) as { result?: { type?: string; web_app?: { url?: string } } };

  const hasMain = me.result?.has_main_web_app === true;
  const menuUrl = menu.result?.web_app?.url;

  console.log('Bot:', me.result?.username);
  console.log('has_main_web_app:', hasMain ? 'YES' : 'NO (startapp channel links will NOT work)');
  console.log('Menu button URL:', menuUrl ?? '(none)');

  if (!hasMain) {
    console.log('\n--- Fix in @BotFather (2 min) ---');
    console.log('1. Open https://t.me/BotFather');
    console.log('2. /mybots → @WLTH_Triage_Bot → Bot Settings');
    console.log('3. Tap "Configure Mini App" (or "Menu Button" → Configure)');
    console.log('4. Set URL: https://wlth-tg-trello-triage.baris-53d.workers.dev');
    console.log('5. /setdomain → @WLTH_Triage_Bot → wlth-tg-trello-triage.baris-53d.workers.dev');
    console.log('6. Run: npm run setup:channel');
    process.exit(1);
  }

  const base = (loadEnv().WEBAPP_URL ?? process.env.WEBAPP_URL ?? menuUrl ?? '').replace(/\/$/, '');
  if (base) {
    const html = await fetch(base).then((r) => r.text());
    const hasWlthUi =
      html.includes('Report an issue') && html.includes('WLTH Product Agent');
    console.log('Live UI check:', hasWlthUi ? 'NEW WLTH theme on server' : 'OLD HTML still on server — redeploy');
    if (!hasWlthUi) process.exit(1);
  }

  console.log('\nIf Telegram still shows the old dark form:');
  console.log('1. @BotFather → your bot → Configure Mini App → URL must match menu URL above');
  console.log('2. Force-quit Telegram (swipe away), reopen');
  console.log('3. Use NEW pinned channel buttons (npm run setup:channel) or bot Menu → Report to Trello');
  console.log('4. Look for gradient header with icon + "WLTH Product Agent"');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
