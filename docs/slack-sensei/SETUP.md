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

## Slack app — Master_Splinter

Use the **Master_Splinter** app only (App ID `A09B18QH509`):

**[api.slack.com/apps/A09B18QH509](https://api.slack.com/apps/A09B18QH509)**

All Worker secrets (`SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`) must come from this app — not CW-ALERTS or another bot.

1. **Event Subscriptions** → Enable → Request URL:  
   `https://wlth-tg-trello-triage.baris-53d.workers.dev/slack-sensei/events`
2. Subscribe to bot event **`app_mention`** (Master_Splinter replies in-thread; full Cursor agent is Phase 2b).
3. **OAuth & Permissions** → scopes at least `chat:write` → install to workspace.
4. Copy **Signing Secret** (Basic Information) → `SLACK_SIGNING_SECRET`.
5. Copy **Bot User OAuth Token** (`xoxb-…`) → `SLACK_BOT_TOKEN`.
6. In channel `C09UABP7X4L`: `/invite @Master_Splinter` (or the bot’s @ handle shown in the app).

## Sentry

1. **Settings → Integrations → Webhooks** (or Internal Integration on app **Master_Splinter**).
2. URL: `https://wlth-tg-trello-triage.baris-53d.workers.dev/slack-sensei/sentry/<SENTRY_WEBHOOK_SECRET>`
3. Subscribe to **Issue** (or alert) webhooks for new alerts.
4. Subscribe to **Seer** webhooks (`root_cause_completed`) on the **same URL** so Splinter stores Seer root cause and posts it in the alert thread.

If Seer only appears via Sentry’s own Slack app (not our webhook), Splinter can hint that Seer is in the thread but cannot quote it until Seer webhooks are enabled. Optional scope: `channels:history` on the bot for thread reads.

## KV incident record

Each issue is stored as `sensei:incident:sentry-{issueId}` with:

- Slack channel + thread `ts`
- Trello card id + short URL
- State: `opened` → `slack_posted` → `trello_created`

Phase 2b will add `agent_running` and Slack approval actions.
