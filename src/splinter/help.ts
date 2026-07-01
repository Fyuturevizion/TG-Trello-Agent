import {
  MASTER_SPLINTER_CMD,
  MASTER_SPLINTER_DISPLAY,
  MASTER_SPLINTER_MENU_CMD,
} from './command';

export function masterSplinterHelpText(): string {
  return [
    `<b>${MASTER_SPLINTER_DISPLAY}</b> (admin only), I maintain the WLTH triage bot`,
    '',
    'I reply in conversation, questions, code changes, all in character.',
    'While I work: typing and meditation quotes (no raw reasoning text).',
    `(Telegram menu: <code>${MASTER_SPLINTER_MENU_CMD}</code>, <code>${MASTER_SPLINTER_CMD}</code> also works in chat.)`,
    '/master-splinter &lt;message&gt;, speak to me',
    '/master-splinter link &lt;bc-id&gt;, attach an existing session',
    '/master-splinter status, last run',
    '/master-splinter cancel, cancel active run',
    '/master-splinter reset, new session next time',
    '',
    '<b>Config</b>',
    '/master-splinter config, show settings',
    '/master-splinter config repo &lt;github url&gt;',
    '/master-splinter config branch &lt;ref&gt;',
    '/master-splinter config model &lt;model id&gt;',
    '/master-splinter config pr on|off',
    '/master-splinter config fast on|off',
    '/master-splinter config session-limit &lt;n&gt;',
    '/master-splinter config instructions &lt;text&gt;',
    '/master-splinter new &lt;message&gt;, force a fresh agent session',
    '/master-splinter allow-qa, register this chat as QA + refresh buttons',
    '/master-splinter test-dm, send sample review DM to you',
  ].join('\n');
}
