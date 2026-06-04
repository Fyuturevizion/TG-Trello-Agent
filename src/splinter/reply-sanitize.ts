/**
 * Strip legacy /agent wording and unsolicited git footers before Telegram.
 * Preserves URLs (e.g. cursor.com/agents/…).
 */

const FOOTER_LINE =
  /^\s*(?:I left my work on branch|I opened a pull request|Pull request:|PR:|Branch:)\b.*$/gim;

const TRAILING_GIT_BLOCK =
  /\n{1,2}(?:I left my work[\s\S]*|I opened a pull request[\s\S]*|(?:^|\n)Branch:\s*`?cursor\/[^\n]*\n?)+$/im;

function stripProtectedUrls(text: string): { text: string; urls: string[] } {
  const urls: string[] = [];
  const protectedText = text.replace(/https?:\/\/\S+/gi, (m) => {
    urls.push(m);
    return `\uE000${urls.length - 1}\uE000`;
  });
  return { text: protectedText, urls };
}

function restoreProtectedUrls(text: string, urls: string[]): string {
  return text.replace(/\uE000(\d+)\uE000/g, (_, i) => urls[Number(i)] ?? '');
}

function stripGitFooters(text: string): string {
  let s = text.replace(FOOTER_LINE, '').replace(TRAILING_GIT_BLOCK, '');
  // Model sometimes appends a lone branch line: `cursor/hello-6ec1`
  s = s.replace(/\n{1,2}`cursor\/[a-z0-9-]+`\.?\s*$/i, '');
  s = s.replace(/\n{1,2}cursor\/[a-z0-9-]+\s*$/i, '');
  // PR / branch lines without the stock phrase
  s = s.replace(/\n{1,2}(?:https?:\/\/github\.com\/\S+\/pull\/\S+)\s*$/gi, '');
  return s.trim();
}

/** Em/en dashes are banned in Master Splinter voice. */
/** Telegram already shows the bot display name; drop redundant sign-offs. */
function stripNameHeader(text: string): string {
  return text
    .replace(/^(\*\*)?Master[_\s]Splinter(\*\*)?\s*[\n:,-]*/i, '')
    .replace(/^\s+/, '')
    .trim();
}

function stripEmDashes(text: string): string {
  return text
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s*–\s*/g, ', ')
    .replace(/,{2,}/g, ',')
    .replace(/,\s*,/g, ',');
}

function fixAgentCommandNames(text: string): string {
  return text
    .replace(/\bthe\s+\/agent\s+path\b/gi, '/master-splinter')
    .replace(/\bthrough\s+the\s+\/agent\s+path\b/gi, 'through /master-splinter')
    .replace(/\bvia\s+the\s+\/agent\s+path\b/gi, 'via /master-splinter')
    .replace(/\bvia\s+\/agent\s+path\b/gi, 'via /master-splinter')
    .replace(/\byour message reached me through the \/agent\b/gi, 'your message reached me through /master-splinter')
    .replace(/\bthe agent path\b/gi, '/master-splinter')
    .replace(/\bsend\s+\/agent\b/gi, 'send /master-splinter')
    .replace(/\buse\s+\/agent\b/gi, 'use /master-splinter')
    .replace(/\bnudge\s+\/agent\b/gi, 'nudge /master-splinter')
    .replace(/\bwith\s+\/agent\b/gi, 'with /master-splinter')
    .replace(/`\/agent`/g, '`/master-splinter`')
    .replace(/\(\/agent\)/gi, '(/master-splinter)')
    .replace(/\/agent\b/gi, '/master-splinter');
}

/** Remove known branch/PR strings from API metadata if the model echoed them. */
export function stripKnownGitRefs(text: string, refs?: { branch?: string; prUrl?: string }): string {
  let s = text;
  if (refs?.branch) {
    const b = refs.branch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    s = s.replace(new RegExp(`\`${b}\``, 'gi'), '');
    s = s.replace(new RegExp(`\\b${b}\\b`, 'gi'), '');
    s = s.replace(new RegExp(`on branch\\s*\`?${b}\`?`, 'gi'), '');
  }
  if (refs?.prUrl) {
    const u = refs.prUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    s = s.replace(new RegExp(u, 'gi'), '');
  }
  return stripGitFooters(s);
}

export function sanitizeSplinterReply(
  text: string,
  git?: { branch?: string; prUrl?: string },
): string {
  const { text: protectedText, urls } = stripProtectedUrls(text);
  let s = stripNameHeader(stripEmDashes(fixAgentCommandNames(protectedText)));
  s = stripKnownGitRefs(s, git);
  s = stripGitFooters(s);
  s = stripEmDashes(stripNameHeader(s));
  s = s.replace(/\n{3,}/g, '\n\n').trim();
  return restoreProtectedUrls(s, urls);
}
