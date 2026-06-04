import type { Env } from './types';

export const CURSOR_API_BASE = 'https://api.cursor.com';

export function cursorAuthHeader(env: Env): string {
  const key = env.CURSOR_API_KEY?.trim();
  if (!key) throw new Error('CURSOR_API_KEY is not configured on the Worker');
  return `Basic ${btoa(`${key}:`)}`;
}

const CURSOR_FETCH_MS = 60_000;

export async function cursorFetch<T>(
  env: Env,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${CURSOR_API_BASE}${path}`, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(CURSOR_FETCH_MS),
    headers: {
      Authorization: cursorAuthHeader(env),
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Cursor API ${path} (${res.status}): ${body.slice(0, 500)}`);
  }
  return JSON.parse(body) as T;
}

/** Parse bc-… id or cursor.com/agents/bc-… URL. */
export function parseAgentId(input: string): string | null {
  const trimmed = input.trim();
  const fromUrl = trimmed.match(/agents\/(bc-[a-f0-9-]+)/i);
  if (fromUrl) return fromUrl[1];
  if (/^bc-[a-f0-9-]+$/i.test(trimmed)) return trimmed;
  return null;
}
