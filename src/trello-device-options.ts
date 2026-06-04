import type { Env } from './types';

const TRELLO_API = 'https://api.trello.com/1';
const NATIVE_APP_OPTION_LABEL = 'Native App';
const NATIVE_APP_OPTION_CACHE_KEY = 'trello:native_app_option_id';
const CACHE_TTL_SECONDS = 90 * 24 * 60 * 60;

interface CustomFieldOption {
  id: string;
  value?: { text?: string };
}

function trelloParams(env: Env): URLSearchParams {
  return new URLSearchParams({
    key: env.TRELLO_API_KEY,
    token: env.TRELLO_TOKEN,
  });
}

function deviceFieldId(env: Env): string {
  const DEFAULT = '69130d9c54d5911255a8d456';
  return env.TRELLO_CUSTOM_FIELD_DEVICE ?? DEFAULT;
}

async function trelloRequest<T>(
  env: Env,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${TRELLO_API}${path}${sep}${trelloParams(env).toString()}`;
  const res = await fetch(url, init);
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Trello ${path} (${res.status}): ${body.slice(0, 500)}`);
  }
  return JSON.parse(body) as T;
}

function normalizeOptionLabel(text: string): string {
  return text.trim().toLowerCase();
}

/** Find or create the "Native App" Device dropdown option via Trello API. */
export async function ensureNativeAppDeviceOptionId(env: Env): Promise<string> {
  const fromEnv = env.TRELLO_DEVICE_OPTION_NATIVE_APP?.trim();
  if (fromEnv) return fromEnv;

  const cached = await env.SESSIONS.get(NATIVE_APP_OPTION_CACHE_KEY);
  if (cached) return cached;

  const fieldId = deviceFieldId(env);
  const options = await trelloRequest<CustomFieldOption[]>(
    env,
    `/customFields/${fieldId}/options`,
  );

  const target = normalizeOptionLabel(NATIVE_APP_OPTION_LABEL);
  const existing = options.find(
    (opt) => opt.value?.text && normalizeOptionLabel(opt.value.text) === target,
  );
  if (existing?.id) {
    await env.SESSIONS.put(NATIVE_APP_OPTION_CACHE_KEY, existing.id, {
      expirationTtl: CACHE_TTL_SECONDS,
    });
    return existing.id;
  }

  const created = await trelloRequest<CustomFieldOption>(env, `/customFields/${fieldId}/options`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      value: { text: NATIVE_APP_OPTION_LABEL },
      color: 'none',
      pos: 'bottom',
    }),
  });

  if (!created.id) {
    throw new Error('Trello did not return an id for the new Native App device option');
  }

  await env.SESSIONS.put(NATIVE_APP_OPTION_CACHE_KEY, created.id, {
    expirationTtl: CACHE_TTL_SECONDS,
  });
  return created.id;
}
