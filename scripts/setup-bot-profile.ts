/**
 * Set Telegram bot display name, description, and profile photo for Master Splinter.
 * Usage: npm run setup:bot-profile
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadDevVars(): Record<string, string> {
  for (const name of ['.dev.vars', '.env']) {
    const path = resolve(process.cwd(), name);
    if (!existsSync(path)) continue;
    const vars: Record<string, string> = {};
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
    return vars;
  }
  return {};
}

function env(key: string): string {
  const value = process.env[key] ?? loadDevVars()[key];
  if (!value) throw new Error(`Missing ${key}`);
  return value;
}

async function api<T>(token: string, method: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json()) as { ok: boolean; description?: string; result?: T };
  if (!data.ok) throw new Error(`${method}: ${data.description ?? response.statusText}`);
  return data.result as T;
}

async function setProfilePhoto(token: string): Promise<void> {
  const avatarPath = resolve(process.cwd(), 'public/master-splinter-avatar.png');
  if (!existsSync(avatarPath)) throw new Error(`Missing ${avatarPath}`);
  const bytes = readFileSync(avatarPath);
  const form = new FormData();
  form.append('photo', JSON.stringify({ type: 'static', photo: 'attach://splinter' }));
  form.append('splinter', new Blob([bytes], { type: 'image/jpeg' }), 'master-splinter-avatar.jpg');
  const response = await fetch(`https://api.telegram.org/bot${token}/setMyProfilePhoto`, {
    method: 'POST',
    body: form,
  });
  const data = (await response.json()) as { ok: boolean; description?: string };
  if (!data.ok) throw new Error(`setMyProfilePhoto: ${data.description}`);
}

async function main(): Promise<void> {
  const token = env('TELEGRAM_BOT_TOKEN');
  const displayName = process.env.BOT_DISPLAY_NAME ?? 'Master Splinter';

  const me = await api<{ username: string; first_name: string }>(token, 'getMe');
  console.log(`Before: ${me.first_name} (@${me.username})`);

  await api(token, 'setMyName', { name: displayName });
  console.log(`Display name → ${displayName}`);

  await api(token, 'setMyShortDescription', {
    short_description: 'WLTH QA triage, report bugs & wishlist. Admin: Master Splinter.',
  });
  await api(token, 'setMyDescription', {
    description:
      'WLTH Product Agent for QA. Reporters use /report. Dojo admin may speak with Master Splinter via /master_splinter.',
  });
  console.log('Description updated');

  await setProfilePhoto(token);
  console.log('Profile photo updated');

  const after = await api<{ username: string; first_name: string }>(token, 'getMe');
  console.log(`After: ${after.first_name} (@${after.username})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
