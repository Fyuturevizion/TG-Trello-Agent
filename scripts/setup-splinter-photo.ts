/**
 * Set @WLTH_Triage_Bot profile photo to Master Splinter.
 * Usage: npm run setup:splinter-photo
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

async function main(): Promise<void> {
  const token = env('TELEGRAM_BOT_TOKEN');
  const avatarPath = resolve(process.cwd(), 'public/master-splinter-avatar.png');
  if (!existsSync(avatarPath)) {
    throw new Error(`Avatar not found: ${avatarPath}`);
  }

  const bytes = readFileSync(avatarPath);
  const form = new FormData();
  form.append(
    'photo',
    JSON.stringify({ type: 'static', photo: 'attach://splinter' }),
  );
  form.append('splinter', new Blob([bytes], { type: 'image/jpeg' }), 'master-splinter-avatar.jpg');

  const response = await fetch(`https://api.telegram.org/bot${token}/setMyProfilePhoto`, {
    method: 'POST',
    body: form,
  });
  const data = (await response.json()) as { ok: boolean; description?: string };
  if (!data.ok) {
    throw new Error(`setMyProfilePhoto: ${data.description ?? response.statusText}`);
  }

  console.log('Master Splinter profile photo set.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
