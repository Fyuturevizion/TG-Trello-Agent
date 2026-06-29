import {
  MASTER_SPLINTER_CMD,
  MASTER_SPLINTER_DISPLAY,
  MASTER_SPLINTER_MENU_CMD,
} from './command';

export function masterSplinterHelpText(questionsOnly = false): string {
  if (questionsOnly) {
    return [
      `<b>${MASTER_SPLINTER_DISPLAY}</b> (dojo member)`,
      '',
      'Ask me questions about the triage bot, Trello flow, or QA process.',
      'I answer in character. I do not change code for members.',
      `(Telegram menu: <code>${MASTER_SPLINTER_MENU_CMD}</code>, <code>${MASTER_SPLINTER_CMD}</code>)`,
      '/master-splinter &lt;question&gt;, speak to me',
      '/master-splinter status, last answer',
      '/master-splinter cancel, cancel active run',
    ].join('\n');
  }

  return [
    `<b>${MASTER_SPLINTER_DISPLAY}</b> (code keeper), I maintain the WLTH triage bot`,
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
    '/master-splinter test, post sample card update to QA channel',
    '/master-splinter test-dm, send sample review DM to you',
  ].join('\n');
}
