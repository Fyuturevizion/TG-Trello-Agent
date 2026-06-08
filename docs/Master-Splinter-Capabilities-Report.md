# Master Splinter — Capabilities Report

**Product:** WLTH QA Triage (Telegram)  
**Bot:** [@WLTH_Triage_Bot](https://t.me/WLTH_Triage_Bot) (display name: **Master Splinter**)  
**Runtime:** Cloudflare Worker (`wlth-tg-trello-triage`)  
**Repository:** [Fyuturevizion/TG-Trello-Agent](https://github.com/Fyuturevizion/TG-Trello-Agent)  
**Report date:** May 2026  

---

## Executive summary

Master Splinter is the admin-facing AI maintainer for the WLTH Telegram QA triage system. The same Telegram bot serves two roles:

1. **Public QA triage** — reporters submit bugs and wishlist items via a Mini App; work is tracked on Trello and announced in QA Telegram channels.
2. **Master Splinter (admin only)** — a Cursor Cloud Agent persona that answers questions, investigates issues, and can change the triage bot codebase, with live “meditation” status in chat while work runs.

Non-admins cannot invoke Master Splinter; unauthorized attempts receive in-character refusal messages.

---

## QA triage bot (what Splinter maintains)

### Reporting flow

| Step | Behaviour |
|------|-----------|
| 1 | User opens the **Telegram Mini App** from channel buttons or `/report`, `/bug`, `/wishlist` |
| 2 | Form validates Telegram `initData`, collects bug/wishlist details (device, steps, photos, etc.) |
| 3 | A **Trello card** is created in **Support/Triage → INBOX** |
| 4 | A **single announcement** is posted to the configured QA channel(s) |
| 5 | **Trello webhooks** push updates back to Telegram when the card is assigned, moved, or completed |

### Channel features

- Pinned **Report bug** / **Wishlist** buttons (`/setup`, admin only).
- Support for **multiple QA Telegram channels** (comma-separated chat IDs in Worker configuration).
- Reporter mentions and card links in channel messages.

### Reporter commands

| Command | Purpose |
|---------|---------|
| `/report` | Open report Mini App |
| `/bug` | Shortcut for bug report |
| `/wishlist` | Shortcut for wishlist item |
| `/help` | Usage help |
| `/chatid` | Show current chat ID (utility) |
| `/myid` | Show caller’s Telegram user ID (utility) |

---

## Master Splinter (admin maintainer)

### Who can use it

- **Dojo keeper** — one designated Telegram user ID (`TELEGRAM_DOJO_KEEPER_ID`).
- **Fixed admins** — IDs listed in Worker secret `TELEGRAM_ADMIN_USER_IDS`.
- **Granted admins** — promoted only by the keeper via hidden `/dojo_grant` + secret phrase (`DOJO_ADMIN_SECRET`).

There is **no** fallback list that accidentally grants admin access. Channel members see `/master_splinter` only if scoped to them in BotFather; the bot still rejects non-admins.

### How admins invoke Splinter

| Method | Example |
|--------|---------|
| Slash command | `/master_splinter` or `/master-splinter` |
| With bot handle (groups) | `/master_splinter@WLTH_Triage_Bot …` |
| Natural ping (admin) | `@WLTH_Triage_Bot …` or `@master_splinter …` |

### Admin commands

| Command | Purpose |
|---------|---------|
| `/master_splinter <message>` | Ask a question or request a code change |
| `/master_splinter help` | Command reference |
| `/master_splinter status` | Check last Cursor run; deliver answer if finished |
| `/master_splinter cancel` | Cancel active Cursor run |
| `/master_splinter reset` | Clear session; next message starts fresh |
| `/master_splinter link <bc-id>` | Attach an existing Cursor agent session |
| `/master_splinter config` | Show agent/repo/model settings |
| `/master_splinter config repo\|branch\|model\|pr\|instructions …` | Update maintainer settings |

### Behaviour while working

- Shows a **live status message** (spinner + rotating “meditation” quotes), not raw model reasoning.
- Uses **Cursor Cloud Agents API** against the configured GitHub repo (default: this triage bot repo).
- **Poll chain** — background checks every few seconds until the run completes, so long tasks are not dropped when the Worker time limit ends.
- **Long replies** are split across multiple Telegram messages (HTML with plain-text fallback).
- Replies are sanitized: no legacy `/agent` wording, no unsolicited branch/PR footers, no em dashes, no redundant “Master Splinter” sign-off (Telegram shows the bot name).

### Optional automation

- `CURSOR_AGENT_AUTO_PR=true` allows the cloud agent to open PRs when configured (Telegram Splinter path; approval workflows are planned separately for Slack).

---

## Security and access control

| Control | Description |
|---------|-------------|
| **Admin lockdown** | Only keeper + explicit admin IDs + keeper-granted IDs |
| **`/dojo_grant`** | Hidden; keeper-only; requires secret phrase to add an admin |
| **Intruder handling** | Non-admins who use `/master_splinter`, @mention the bot, or say “Master Splinter” get humorous refusal + `/report` / `/bug` guidance |
| **Webhook secrets** | Telegram and Trello webhooks verified by shared secret |
| **Mini App auth** | Reports require valid Telegram Web App `initData` |

---

## Technical architecture (summary)

| Component | Technology |
|-----------|------------|
| API / routing | Hono on Cloudflare Workers |
| Session / idempotency | Cloudflare KV |
| Mini App | Static assets in `public/` |
| Integrations | Telegram Bot API, Trello REST + webhooks, Cursor Cloud Agents API |
| Agent module | `src/splinter/` (handlers, relay, presence, poll delivery, prompts) |
| Command routing | `src/commands/dispatch.ts` |
| Scheduled jobs | Minute: deliver pending Splinter replies; daily: webhook health check |

**Deployed URL:** `https://wlth-tg-trello-triage.baris-53d.workers.dev`

---

## Out of scope today (planned)

The following are **not** part of the current Telegram Master Splinter deployment:

- Slack **agent** commands and approval gate (Phase 2b/2c)  
- Sentry → Slack + Trello (Phase 2a) is deployed via **Master_Splinter** Slack app `A09B18QH509` — see `docs/slack-sensei/SETUP.md`  
- Multi-repo fixes (PWA, backend, smart contracts, common-wealth-ui)  
- Slack sign-off before commit/PR  
- Matomo crashlytics ingestion  

Phase 2 (**Slack Sensei**) is scoped on branch `master-splinter-slack-sensei`; see `docs/slack-sensei/PHASE2-PLAN.md`.

---

## Summary table

| Audience | Capability |
|----------|------------|
| **QA reporters** | Mini App → Trello INBOX + channel updates |
| **Admins** | `/setup`, full Master Splinter maintainer |
| **Keeper** | `/dojo_grant` to add admins; supreme access |
| **Everyone else** | Triage commands only; Splinter access denied with in-character messaging |

---

*This document describes capabilities implemented in the TG-Trello-Agent codebase on the `master-splinter-slack-sensei` development line, including the Splinter refactor and dojo access controls.*
