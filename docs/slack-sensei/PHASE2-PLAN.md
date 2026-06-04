# Phase 2 — Slack Sensei (Master Splinter variant)

Branch: **`master-splinter-slack-sensei`**

Slack Sensei lives in a Slack channel, ingests Sentry (and later Matomo crash) signals, runs a Cursor cloud agent across WLTH repos, updates Trello, and threads progress back in Slack. **No commit or PR until a human approves in Slack.**

Telegram Master Splinter (Phase 1) stays as-is in `src/splinter/`; Slack is a parallel integration, not a rewrite.

---

## Goals

| Capability | Detail |
|------------|--------|
| **Ingress** | Sentry alert → Slack channel (native integration or webhook) |
| **Agent** | Cursor Cloud Agent with multi-repo context (PWA, backend, smart contracts, common-wealth-ui) |
| **Trello** | Create/link card on incident; comment as work progresses |
| **Slack thread** | Status, summary, diff links; approval gate before git |
| **Sign-off** | Interactive Slack button or reaction → then branch commit + PR |
| **Later** | Matomo crashlytics → same pipeline |

---

## Recommended architecture

```
Sentry ──► Slack (#sentry-alerts)
              │
              ▼ (Events API / webhook)
        Cloudflare Worker  (this repo or sibling worker)
              │
              ├─► KV: incident session (sentryId, thread_ts, trelloCardId, agentId, runId, state)
              ├─► Cursor API: start / follow-up run (multi-repo prompt)
              ├─► Trello API: card + comments
              └─► Slack API: thread replies + Block Kit actions (Approve / Reject)
```

**Why same Worker pattern as Telegram:** You already have Hono, KV sessions, Cursor client, Trello client, and poll-chain delivery. Phase 2 adds `src/slack-sensei/` mirroring `src/splinter/`.

**Why a separate Worker (optional later):** If Slack + Telegram traffic grows, split `wlth-slack-sensei` Worker; for Phase 2a, one repo with route prefixes is fine (`/slack/events`, `/sentry/webhook`).

---

## Phased delivery

### Phase 2a — Skeleton (week 1)

- [ ] Slack app: bot token, signing secret, Events API URL
- [ ] `POST /slack/events` — verify signature, handle `app_mention`, slash command `/sensei`
- [ ] `POST /sentry/webhook` — map issue → Slack parent message + Trello INBOX card
- [ ] KV schema: `sensei:incident:{id}`
- [ ] Reuse `cursor-api`, `poll-delivery` pattern for long runs
- [ ] Prompt pack: repo list + “Slack Sensei” persona (no Telegram rules)

### Phase 2b — Agent + Trello loop (week 2)

- [ ] On Sentry event: post to Slack with issue link, severity, stack snippet
- [ ] Auto-start Cursor run with prompt: investigate + propose fix (branch name from sentry short id)
- [ ] Thread updates: “investigating…”, tool use, draft summary
- [ ] Trello: create card “Sentry: {title}”, add comments on state changes
- [ ] **No auto-commit** — agent stops at “ready for review” with diff summary in thread

### Phase 2c — Slack approval gate (week 3)

- [ ] Block Kit: **Approve PR** / **Request changes** / **Cancel**
- [ ] Only approvers in `SLACK_SENSEI_APPROVER_IDS` (like `TELEGRAM_DOJO_KEEPER_ID`)
- [ ] On Approve: commit to branch, push, open PR, post PR URL to thread + Trello
- [ ] On Reject: cancel run, update Trello + thread

### Phase 2d — Matomo + polish

- [ ] Matomo crash webhook → normalize to same incident shape as Sentry
- [ ] Multi-repo routing rules (which repos to touch per project / tag)
- [ ] Dashboards: open incidents in KV, link Slack thread + Trello + PR

---

## Multi-repo knowledge (Cursor)

Configure agent with **multiple repository URLs** (Cursor supports repo context per run — confirm API for multi-repo; if single-repo only, use monorepo meta-repo or sequential runs).

| Repo | Role |
|------|------|
| PWA | Frontend app |
| Backend | API / services |
| Smart contracts | On-chain |
| common-wealth-ui | Shared UI kit |

**Env (secrets):**

```bash
SENSEI_REPO_PWA_URL=
SENSEI_REPO_BACKEND_URL=
SENSEI_REPO_CONTRACTS_URL=
SENSEI_REPO_UI_URL=
SENSEI_REPO_DEFAULT_REF=main
```

System prompt: incident context from Sentry (stack, release, breadcrumbs), which repos are in scope, branch naming `fix/sentry-{SHORT_ID}`, and **hard rule: do not push until Slack approval**.

---

## Slack vs Telegram differences

| | Telegram Splinter | Slack Sensei |
|--|-------------------|--------------|
| Trigger | `/master_splinter` | Sentry webhook + `@Sensei` + `/sensei` |
| UI | Meditation quotes | Thread + Block Kit |
| Git | Optional auto-PR (env) | **Always** approval-gated |
| Audience | QA dojo | Eng on-call |
| Trello | Reporter-driven INBOX | Incident-linked card |

---

## Secrets checklist

| Secret | Purpose |
|--------|---------|
| `SLACK_BOT_TOKEN` | `xoxb-…` |
| `SLACK_SIGNING_SECRET` | Events API verification |
| `SLACK_SENSEI_CHANNEL_ID` | `#sentry-alerts` (or C…) |
| `SLACK_SENSEI_APPROVER_IDS` | Comma Slack user IDs |
| `SENTRY_WEBHOOK_SECRET` | Verify Sentry outbound |
| Existing `CURSOR_API_KEY`, `TRELLO_*` | Reuse |

---

## Open decisions (need your input)

1. **One Slack channel or separate** for Sentry vs general Sensei commands?
2. **Trello board/list** for Sensei incidents (same Support/Triage INBOX or new list)?
3. **Repo access** — exact GitHub URLs for the four repos?
4. **Sentry** — Cloud vs self-hosted? Use Sentry’s Slack integration first, or Worker-only?
5. **Approval** — who besides you can press Approve (Slack user IDs)?

---

## Branch hygiene

- `main` — Telegram triage + Splinter (stable)
- `master-splinter-slack-sensei` — Phase 2 work (this branch)
- Merge to `main` only when Slack path is behind feature flag or separate Worker name

---

## Suggested first PR on this branch

1. `docs/slack-sensei/PHASE2-PLAN.md` (this file)
2. `src/slack-sensei/` stubs: `types.ts`, `slack-verify.ts`, `routes.ts` (health + ping)
3. `wrangler.jsonc` comment block for future Sensei secrets (no values)

No production Slack wiring until Sentry + channel IDs are confirmed.
