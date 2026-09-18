/** Admin asked to clear only the bot's messages (natural language or explicit command). */
export function isPurgeBotMessagesRequest(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  if (/purge-bot-messages|purge bot messages|clear-bot-messages|clear bot messages/.test(t)) {
    return true;
  }
  if (t === 'purge-channel' || t.startsWith('purge-channel ')) return true;
  if (!t.includes('delete') && !t.includes('clear') && !t.includes('remove')) return false;
  if (t.includes('only delete your') || t.includes('only your message')) return true;
  if (t.includes('your message') || t.includes('your messages')) {
    return t.includes('delete') || t.includes('clear') || t.includes('remove');
  }
  if (t.includes('start fresh') && (t.includes('delete') || t.includes('clear'))) return true;
  if (
    (t.includes('we have said') || t.includes('you have said') || t.includes('you said')) &&
    (t.includes('delete') || t.includes('clear'))
  ) {
    return true;
  }
  return false;
}

/** Pull the admin's words out of a wrapped Cursor prompt. */
export function extractUserPromptFromWrapped(promptText: string): string {
  const marker = 'Message from the dojo admin';
  const idx = promptText.indexOf(marker);
  if (idx === -1) return promptText.trim();
  const afterLabel = promptText.indexOf(':', idx);
  if (afterLabel === -1) return promptText.trim();
  const body = promptText.slice(afterLabel + 1);
  const end = body.indexOf('\n---');
  return (end === -1 ? body : body.slice(0, end)).trim();
}
