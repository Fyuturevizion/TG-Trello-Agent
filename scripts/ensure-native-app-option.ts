/**
 * Ensure "Native App" exists on the Trello Device dropdown (creates via API if missing).
 * Run: npm run ensure-native-app-device
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ensureNativeAppDeviceOptionId } from '../src/trello-device-options';

function loadDevVars(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const name of ['.dev.vars', '.env']) {
    const path = resolve(process.cwd(), name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
  }
  return vars;
}

function env(key: string): string {
  const value = process.env[key] ?? loadDevVars()[key];
  if (!value) throw new Error(`Missing ${key} in env or .dev.vars`);
  return value;
}

async function main(): Promise<void> {
  const mockEnv = {
    TRELLO_API_KEY: env('TRELLO_API_KEY'),
    TRELLO_TOKEN: env('TRELLO_TOKEN'),
    TRELLO_CUSTOM_FIELD_DEVICE:
      process.env.TRELLO_CUSTOM_FIELD_DEVICE ?? loadDevVars().TRELLO_CUSTOM_FIELD_DEVICE,
    TRELLO_DEVICE_OPTION_NATIVE_APP:
      process.env.TRELLO_DEVICE_OPTION_NATIVE_APP ?? loadDevVars().TRELLO_DEVICE_OPTION_NATIVE_APP,
    SESSIONS: {
      get: async () => null,
      put: async () => undefined,
    },
  } as Parameters<typeof ensureNativeAppDeviceOptionId>[0];

  const optionId = await ensureNativeAppDeviceOptionId(mockEnv);
  console.log('Native App device option ready.');
  console.log(`TRELLO_DEVICE_OPTION_NATIVE_APP=${optionId}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
