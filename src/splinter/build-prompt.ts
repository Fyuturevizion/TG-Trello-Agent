import type { AgentConfig } from './config';
import { MASTER_SPLINTER_VOICE, TELEGRAM_REPLY_FORMAT } from './prompts';

/** Wrap admin requirements as a full cloud-agent build task. */
export function wrapBuildRequirementsPrompt(userRequirements: string, config: AgentConfig): string {
  const prLine = config.autoCreatePR
    ? '- Open a draft pull request against main when the change is ready.'
    : '- Push your branch; the admin will merge and deploy from Telegram.';

  return [
    'Build task from the dojo admin via Telegram (requirements → implementation).',
    '',
    '## Requirements',
    userRequirements.trim(),
    '',
    '## Deliverables',
    '- Implement in the configured GitHub repo only.',
    '- Match existing code style; keep the diff focused.',
    '- Run `npm run typecheck` and fix any errors before you finish.',
    '- Commit with a clear message and push to a `cursor/*` branch.',
    prLine,
    '- Do not run Cloudflare deploy yourself; the admin uses `/master_splinter deploy` from Telegram.',
    '',
    MASTER_SPLINTER_VOICE,
    '',
    TELEGRAM_REPLY_FORMAT,
  ].join('\n');
}
