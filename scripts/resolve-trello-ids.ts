/**
 * List Trello boards, lists, and labels for setup.
 * Run locally with credentials in .dev.vars — never commit tokens.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

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

function params(key: string, token: string): URLSearchParams {
  return new URLSearchParams({ key, token });
}

async function get<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} → ${response.status}`);
  return response.json() as Promise<T>;
}

async function main(): Promise<void> {
  const apiKey = env('TRELLO_API_KEY');
  const token = env('TRELLO_TOKEN');
  const q = params(apiKey, token);

  const boards = await get<Array<{ id: string; name: string }>>(
    `https://api.trello.com/1/members/me/boards?${q}&fields=name,id`,
  );

  console.log('\n=== Boards ===');
  for (const board of boards) {
    console.log(`${board.name}\n  id: ${board.id}`);
  }

  const boardFilter = process.env.TRELLO_BOARD_NAME ?? loadDevVars().TRELLO_BOARD_NAME;
  const board = boardFilter
    ? boards.find((b) => b.name.toLowerCase().includes(boardFilter.toLowerCase()))
  : boards[0];

  if (!board) {
    console.log('\nNo matching board. Set TRELLO_BOARD_NAME in .dev.vars to filter.');
    return;
  }

  console.log(`\n=== Lists on "${board.name}" ===`);
  const lists = await get<Array<{ id: string; name: string }>>(
    `https://api.trello.com/1/boards/${board.id}/lists?${q}&fields=name,id`,
  );
  for (const list of lists) {
    console.log(`${list.name}\n  TRELLO_INBOX_LIST_ID=${list.id}`);
  }

  console.log(`\n=== Labels on "${board.name}" ===`);
  const labels = await get<Array<{ id: string; name: string; color: string }>>(
    `https://api.trello.com/1/boards/${board.id}/labels?${q}`,
  );
  for (const label of labels) {
    console.log(`${label.name} (${label.color})\n  id: ${label.id}`);
  }

  console.log(`\n=== Custom fields on "${board.name}" ===`);
  const fields = await get<
    Array<{
      id: string;
      name: string;
      type: string;
      options?: Array<{ id: string; value: { text: string } }>;
    }>
  >(`https://api.trello.com/1/boards/${board.id}/customFields?${q}`);
  for (const field of fields) {
    console.log(`\n${field.name} (${field.type})\n  TRELLO_CUSTOM_FIELD_${field.name.replace(/\s+/g, '_').toUpperCase()}=${field.id}`);
    if (field.options) {
      for (const opt of field.options) {
        console.log(`    - ${opt.value.text}: ${opt.id}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
