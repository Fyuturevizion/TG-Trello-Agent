import type { Env } from '../types';

const SLACK_API = 'https://slack.com/api';

type SlackMessage = { text?: string; user?: string; bot_id?: string };

type ConversationsRepliesResult = {
  ok: boolean;
  error?: string;
  messages?: SlackMessage[];
};

/** Best-effort: read thread text (needs channels:history or groups:history). */
export async function slackThreadLooksLikeSeer(
  env: Env,
  channel: string,
  threadTs: string,
): Promise<boolean> {
  const token = env.SLACK_BOT_TOKEN?.trim();
  if (!token) return false;

  try {
    const params = new URLSearchParams({
      channel,
      ts: threadTs,
      limit: '40',
    });
    const response = await fetch(`${SLACK_API}/conversations.replies?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await response.json()) as ConversationsRepliesResult;
    if (!data.ok || !data.messages) return false;

    return data.messages.some((m) => {
      const t = (m.text ?? '').toLowerCase();
      return (
        t.includes('seer') ||
        t.includes('root cause') ||
        t.includes('autofix') ||
        t.includes('suggested fix')
      );
    });
  } catch {
    return false;
  }
}
