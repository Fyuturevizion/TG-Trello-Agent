import type { Env } from '../types';

const DEFAULT_REPO = 'Fyuturevizion/TG-Trello-Agent';
const WORKFLOW_FILE = 'deploy.yml';

/** Trigger GitHub Actions "Deploy Worker" on main (needs GITHUB_DEPLOY_TOKEN). */
export async function triggerWorkerDeployFromTelegram(env: Env): Promise<{
  ok: boolean;
  message: string;
}> {
  const token = env.GITHUB_DEPLOY_TOKEN?.trim();
  if (!token) {
    return {
      ok: false,
      message:
        'Deploy token is not configured. Add Worker secret GITHUB_DEPLOY_TOKEN (fine-grained PAT with Actions read/write on this repo).',
    };
  }

  const repo = env.GITHUB_DEPLOY_REPO?.trim() || DEFAULT_REPO;
  const ref = env.GITHUB_DEPLOY_REF?.trim() || 'main';

  const url = `https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW_FILE}/dispatches`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ref }),
  });

  if (response.status === 204) {
    return {
      ok: true,
      message: `Deploy started on <code>${escapeHtml(repo)}</code> (<code>${escapeHtml(ref)}</code>). Watch GitHub Actions for wlth-tg-trello-triage.`,
    };
  }

  const body = await response.text();
  let detail = body.slice(0, 400);
  try {
    const json = JSON.parse(body) as { message?: string };
    if (json.message) detail = json.message;
  } catch {
    // use raw
  }

  return {
    ok: false,
    message: `Deploy dispatch failed (${response.status}): ${escapeHtml(detail)}`,
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
