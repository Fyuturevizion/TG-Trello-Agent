export interface ParsedSentryIssue {
  issueId: string;
  title: string;
  level?: string;
  project?: string;
  culprit?: string;
  permalink?: string;
  stackSnippet?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringField(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/** Normalize Sentry issue alert / integration webhook payloads. */
export function parseSentryWebhook(payload: unknown): ParsedSentryIssue | null {
  const root = asRecord(payload);
  if (!root) return null;

  const data = asRecord(root.data) ?? root;
  const event = asRecord(data.event);
  let issue = asRecord(data.issue);
  if (!issue && event) issue = asRecord(event.issue);
  if (!issue) issue = data;

  const issueId =
    stringField(issue, 'id') ??
    stringField(data, 'issue_id') ??
    stringField(root, 'issue_id');
  const title =
    stringField(issue, 'title') ??
    (event ? stringField(event, 'title') : undefined) ??
    stringField(data, 'title');
  if (!issueId || !title) return null;

  const metadata = asRecord(issue.metadata) ?? (event ? asRecord(event.metadata) : null);
  const value = metadata ? stringField(metadata, 'value') : undefined;
  const projectObj = asRecord(issue.project);

  return {
    issueId,
    title,
    level: stringField(issue, 'level') ?? (event ? stringField(event, 'level') : undefined),
    project:
      (projectObj ? stringField(projectObj, 'slug') ?? stringField(projectObj, 'name') : undefined) ??
      stringField(data, 'project'),
    culprit: stringField(issue, 'culprit'),
    permalink:
      stringField(issue, 'permalink') ??
      stringField(issue, 'web_url') ??
      stringField(data, 'url'),
    stackSnippet: value?.slice(0, 1200),
  };
}
