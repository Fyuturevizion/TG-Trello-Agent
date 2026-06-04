# Slack Sensei — Phase 2a setup

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/slack-sensei/health` | Config readiness |
| POST | `/slack-sensei/events` | Slack Events API (signature verified) |
| POST | `/slack-sensei/sentry/:secret` | Sentry alert → Slack thread + Trello card |

Use your Worker base URL, e.g. `https://wlth-tg-trello-triage.baris-53d.workers.dev`.

## Secrets

```bash
wrangler secret put SLACK_BOT_TOKEN
wrangler secret put SLACK_SIGNING_SECRET
wrangler secret put SLACK_SENSEI_CHANNEL_ID    # e.g. C0123456789
wrangler secret put SENTRY_WEBHOOK_SECRET      # choose a long random string
```

Optional: `TRELLO_SENSEI_LIST_ID` (else uses `TRELLO_INBOX_LIST_ID`).

## Slack app

1. Create app at [api.slack.com/apps](https://api.slack.com/apps).
2. **Event Subscriptions** → Enable → Request URL:  
   `https://<worker>/slack-sensei/events`
3. Subscribe to bot events you need later (`app_mention` for Phase 2b).
4. Install to workspace; invite bot to the Sentry alerts channel.
5. Copy **Signing Secret** → `SLACK_SIGNING_SECRET`.
6. **OAuth** → `chat:write` scope → Bot token → `SLACK_BOT_TOKEN`.

## Sentry

1. **Settings → Integrations → Webhooks** (or Internal Integration).
2. URL: `https://<worker>/slack-sensei/sentry/<SENTRY_WEBHOOK_SECRET>`
3. Trigger on **Issue** created (or alert rule webhook).

## KV incident record

Each issue is stored as `sensei:incident:sentry-{issueId}` with:

- Slack channel + thread `ts`
- Trello card id + short URL
- State: `opened` → `slack_posted` → `trello_created`

Phase 2b will add `agent_running` and Slack approval actions.
