/**
 * Register Trello board webhooks for Support/Triage + Development boards.
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

type TrelloBoard = { id: string; name: string };
type TrelloWebhook = {
  id: string;
  description: string;
  idModel: string;
  callbackURL: string;
  active: boolean;
};

function trelloQuery(env: Record<string, string>): URLSearchParams {
  return new URLSearchParams({ key: env.TRELLO_API_KEY!, token: env.TRELLO_TOKEN! });
}

async function trelloGet<T>(
  env: Record<string, string>,
  path: string,
  extra?: Record<string, string>,
): Promise<T> {
  const q = trelloQuery(env);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) q.set(k, v);
  }
  const res = await fetch(`https://api.trello.com/1${path}?${q}`);
  const body = await res.text();
  if (!res.ok) throw new Error(`${path} → ${res.status} ${body}`);
  return JSON.parse(body) as T;
}

async function listBoards(env: Record<string, string>): Promise<TrelloBoard[]> {
  return trelloGet(env, '/members/me/boards', { fields: 'id,name' });
}

async function listWebhooks(env: Record<string, string>): Promise<TrelloWebhook[]> {
  const token = env.TRELLO_TOKEN!;
  return trelloGet(env, `/tokens/${token}/webhooks`);
}

async function registerWebhook(
  env: Record<string, string>,
  board: TrelloBoard,
  callbackURL: string,
  existing: TrelloWebhook[],
): Promise<'created' | 'skipped'> {
  const already = existing.find(
    (w) => w.idModel === board.id && w.callbackURL === callbackURL && w.active,
  );
  if (already) {
    console.log(`  skip (already registered): ${board.name} → webhook ${already.id}`);
    return 'skipped';
  }

  const q = trelloQuery(env);
  q.set('callbackURL', callbackURL);
  q.set('idModel', board.id);
  q.set('description', `WLTH TG Triage — ${board.name}`);

  const res = await fetch(`https://api.trello.com/1/webhooks/?${q}`, { method: 'POST' });
  const body = await res.text();
  if (!res.ok) {
    if (body.includes('URL not reachable')) {
      console.error('  Trello could not reach the callback URL. Deploy the Worker first, then re-run.');
    }
    throw new Error(`register ${board.name}: ${res.status} ${body}`);
  }

  const created = JSON.parse(body) as { id: string };
  console.log(`  registered: ${board.name} (board ${board.id}) → webhook ${created.id}`);
  return 'created';
}

function findDevBoard(boards: TrelloBoard[], env: Record<string, string>): TrelloBoard | undefined {
  const id = env.TRELLO_DEV_BOARD_ID?.trim();
  if (id) {
    const byId = boards.find((b) => b.id === id);
    if (byId) return byId;
    console.warn(`  TRELLO_DEV_BOARD_ID=${id} not found in your boards — searching by name`);
  }
  return boards.find((b) => b.name.toLowerCase().includes('development'));
}

async function main(): Promise<void> {
  const env: Record<string, string> = { ...loadEnv(), ...process.env } as Record<string, string>;
  const key = env.TRELLO_API_KEY;
  const token = env.TRELLO_TOKEN;
  const triageBoardId = env.TRELLO_BOARD_ID ?? '6682b4ab48fd9e545c9c8f55';
  const base = (env.WEBHOOK_BASE_URL ?? env.WEBAPP_URL ?? '').replace(/\/$/, '');
  const secret = env.TELEGRAM_WEBHOOK_SECRET;

  if (!key || !token || !base || !secret) {
    throw new Error('Need TRELLO_API_KEY, TRELLO_TOKEN, WEBAPP_URL, TELEGRAM_WEBHOOK_SECRET');
  }

  const callbackURL = `${base}/trello-webhook/${secret}`;
  const boards = await listBoards(env);
  const triageBoard = boards.find((b) => b.id === triageBoardId);
  if (!triageBoard) {
    throw new Error(`TRELLO_BOARD_ID ${triageBoardId} not found. Run npm run resolve-trello-ids`);
  }

  const devBoard = findDevBoard(boards, env);

  console.log('Callback URL:', callbackURL);
  console.log('\nExisting webhooks for this token:');
  const existing = await listWebhooks(env);
  if (existing.length === 0) {
    console.log('  (none)');
  } else {
    for (const w of existing) {
      const boardName = boards.find((b) => b.id === w.idModel)?.name ?? w.idModel;
      console.log(`  - ${w.id} | ${boardName} | active=${w.active}`);
    }
  }

  console.log('\nRegistering:');
  let created = 0;
  if ((await registerWebhook(env, triageBoard, callbackURL, existing)) === 'created') created += 1;

  if (devBoard) {
    if (devBoard.id === triageBoard.id) {
      console.log('  skip Development: same board as Support/Triage');
    } else {
      if ((await registerWebhook(env, devBoard, callbackURL, existing)) === 'created') created += 1;
      if (!env.TRELLO_DEV_BOARD_ID?.trim()) {
        console.log(`\nAdd to .env for explicit Development board id:\nTRELLO_DEV_BOARD_ID=${devBoard.id}`);
      }
    }
  } else {
    console.log('\nNo Development board found. Set TRELLO_DEV_BOARD_ID in .env and re-run.');
  }

  console.log(`\nDone (${created} new webhook(s)).`);
  console.log('Events: assign, leave INBOX, move to Development, DONE/archive → QA channel + reporter tag.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
