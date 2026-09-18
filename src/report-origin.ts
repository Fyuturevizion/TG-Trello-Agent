/** Encode hub + forum topic into Telegram Mini App start_param (startapp=…). */
export function buildReportStartAppParam(
  kind: 'bug' | 'wishlist' | 'product',
  chatId: number,
  messageThreadId?: number,
): string {
  if (!messageThreadId) return kind;
  const abs = String(Math.abs(chatId));
  return `${kind}_c${abs}t${messageThreadId}`;
}

export interface ReportOrigin {
  chatId: number;
  messageThreadId?: number;
}

/** Parse start_param from Mini App (e.g. bug_c1004465145918t42). */
export function parseReportStartAppParam(startParam: string): {
  kind: string;
  origin: ReportOrigin | null;
} {
  const trimmed = startParam.trim();
  if (!trimmed) return { kind: '', origin: null };

  const withOrigin = /^(\w+)_c(\d+)t(\d+)$/i.exec(trimmed);
  if (withOrigin) {
    const abs = withOrigin[2];
    const threadId = Number(withOrigin[3]);
    const chatId = -Number(abs);
    if (Number.isFinite(chatId) && Number.isFinite(threadId)) {
      return { kind: withOrigin[1].toLowerCase(), origin: { chatId, messageThreadId: threadId } };
    }
  }

  return { kind: trimmed.toLowerCase(), origin: null };
}

export function parseReportOriginBody(raw: unknown): ReportOrigin | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  const chatId = Number(b.originChatId);
  const threadId = b.originThreadId === undefined || b.originThreadId === null
    ? undefined
    : Number(b.originThreadId);
  if (!Number.isFinite(chatId)) return null;
  if (threadId !== undefined && !Number.isFinite(threadId)) return null;
  return { chatId, messageThreadId: threadId };
}
