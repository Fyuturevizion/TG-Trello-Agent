import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { webappUrlWithVersion } from '../src/webapp-version';

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
  const env = { ...loadEnv(), ...process.env };
  const token = env.TELEGRAM_BOT_TOKEN;
  const base = (env.WEBAPP_URL ?? '').replace(/\/$/, '');
  if (!token || !base) throw new Error('Need TELEGRAM_BOT_TOKEN and WEBAPP_URL');

  const res = await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      menu_button: {
        type: 'web_app',
        text: 'Report to Trello',
        web_app: { url: webappUrlWithVersion(base) },
      },
    }),
  });
  const data = (await res.json()) as { ok: boolean; description?: string };
  if (!data.ok) throw new Error(data.description ?? 'setChatMenuButton failed');
  console.log('Menu button set to', webappUrlWithVersion(base));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
