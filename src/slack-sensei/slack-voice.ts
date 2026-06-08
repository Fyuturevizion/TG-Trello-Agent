import { SLACK_SENSEI_DISPLAY } from './identity';
import type { SenseiIncident } from './types';

/** Short Slack-native replies (not the long Telegram maintainer brief). */
export function formatSlackMentionReply(
  userText: string,
  incident: SenseiIncident | null,
  threadHasSeerHints: boolean,
): string {
  const q = userText.toLowerCase();
  const asksSeer =
    /\bseer\b/.test(q) || /\broot cause\b/.test(q) || /\bautofix\b/.test(q);

  if (incident) {
    const parts = [`*${incident.title}*`];
    if (incident.trelloShortUrl) {
      parts.push(`<${incident.trelloShortUrl}|Trello>`);
    }
    if (incident.sentryUrl) {
      parts.push(`<${incident.sentryUrl}|Sentry>`);
    }

    if (incident.seerRootCause) {
      parts.push('', '*Seer (on file):*', incident.seerRootCause.slice(0, 1200));
      if (asksSeer || !userText) {
        return parts.join('\n');
      }
    } else if (threadHasSeerHints) {
      parts.push(
        '',
        'Seer text is in this thread from Sentry. I do not have the structured Seer webhook yet, so I cannot quote it cleanly. Subscribe Seer webhooks to this Worker to fix that.',
      );
    } else if (asksSeer) {
      parts.push(
        '',
        'No Seer analysis stored for this issue yet. If Sentry Seer finished, enable Seer webhooks on Master_Splinter (same app as issue alerts).',
      );
    }

    if (userText && !asksSeer) {
      parts.push(
        '',
        'Ask me about Seer, the root cause, or what to fix next. Phase 2b will run Cursor from this thread.',
      );
    } else if (!userText) {
      parts.push('', 'What would you like me to look at in this incident?');
    }

    return parts.join('\n');
  }

  if (!userText || /^(hi|hello|hey)\??$/i.test(userText)) {
    return 'I am here. Mention me on a Sentry alert thread and I can speak to that issue, Seer, and Trello.';
  }

  if (asksSeer) {
    return 'Mention me *in the thread* under a Sentry alert so I know which issue you mean.';
  }

  return `I hear you. For an incident, reply in that alert thread with @${SLACK_SENSEI_DISPLAY.toLowerCase()}.`;
}
