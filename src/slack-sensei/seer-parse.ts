function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringField(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

export interface ParsedSeerRootCause {
  issueId: string;
  summary: string;
}

/** Sentry integration platform Seer webhook (resource: seer). */
export function parseSeerWebhook(payload: unknown): ParsedSeerRootCause | null {
  const root = asRecord(payload);
  if (!root) return null;

  const action = stringField(root, 'action');
  if (action !== 'root_cause_completed' && action !== 'seer.root_cause_completed') {
    return null;
  }

  const data = asRecord(root.data);
  if (!data) return null;

  const groupId = data.group_id;
  const issueId =
    typeof groupId === 'number' ? String(groupId) : typeof groupId === 'string' ? groupId : undefined;
  if (!issueId) return null;

  const rootCause = asRecord(data.root_cause);
  if (!rootCause) return null;

  const description = stringField(rootCause, 'description');
  const steps = Array.isArray(rootCause.steps) ? rootCause.steps : [];
  const stepLines = steps
    .map((s) => asRecord(s))
    .filter(Boolean)
    .map((s) => stringField(s!, 'title'))
    .filter(Boolean) as string[];

  const summary = [description, ...stepLines].filter(Boolean).join('\n');
  if (!summary) return null;

  return { issueId, summary: summary.slice(0, 4000) };
}
