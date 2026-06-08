import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Load KEY=value pairs from .env and .dev.vars into process.env (does not overwrite existing). */
export function loadEnvFiles(cwd = process.cwd()): void {
  for (const name of ['.env', '.dev.vars']) {
    const path = resolve(cwd, name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

export function requireEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`Missing ${key} (set in .env, .dev.vars, or the environment)`);
  return value;
}
