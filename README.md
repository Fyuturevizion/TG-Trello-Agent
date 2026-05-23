# WLTH TG → Trello QA Triage

Telegram Mini App + bot for the WLTH QA channel. Reporters fill a Trello-like form in-app; **one announcement** is posted to the channel per submission. Trello webhooks notify the channel on assign, list moves, and DONE.

## Architecture

- **Mini App** — `https://wlth-tg-trello-triage.baris-53d.workers.dev` (form UI)
- **Worker** — `/api/report`, Telegram webhook, Trello webhook, static assets
- **Trello** — Support/Triage board → INBOX list + custom fields (Device, ERC ADDRESS)

## Channel triggers

Pinned message with inline buttons (open Mini App inside Telegram):

- **Report bug** → `t.me/WLTH_Triage_Bot?startapp=bug`
- **Wishlist** → `t.me/WLTH_Triage_Bot?startapp=wishlist`

Optional: [@BotFather](https://t.me/BotFather) `/setdomain` → `wlth-tg-trello-triage.baris-53d.workers.dev` only if you want `web_app` inline buttons instead of `startapp` links.

Also: bot menu **Report to Trello**, `/report` in chat.

## Setup

### 1. Install & secrets

```bash
npm install
cp .env.example .dev.vars
# Fill TELEGRAM_*, TRELLO_*, CLOUDFLARE_* 
```

```bash
wrangler kv namespace create SESSIONS  # if not done
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_WEBHOOK_SECRET
wrangler secret put TELEGRAM_QA_CHAT_ID
wrangler secret put TRELLO_API_KEY
wrangler secret put TRELLO_TOKEN
wrangler secret put TRELLO_INBOX_LIST_ID
```

### 2. Deploy

```bash
npm run deploy
```

Update `WEBAPP_URL` in `wrangler.jsonc` if your workers.dev URL differs.

### 3. Telegram webhook

```bash
WEBHOOK_BASE_URL=https://your-worker.workers.dev npm run set-webhook
```

### 4. Post channel buttons + menu + Trello webhook

```bash
npm run setup:all
```

Or individually: `setup:menu`, `setup:channel`, `setup:trello-webhook`

In the QA channel (bot must be **admin** to pin): `/setup` also posts triggers.

## Bot commands

| Command | Action |
|---------|--------|
| `/report` | Open Mini App (inline buttons) |
| `/bug` / `/wishlist` | Open app with type preset |
| `/setup` | Post pinned channel buttons |
| `/help` | Help + buttons |
| `/chatid` | Show chat ID |
| `/agent` | **Admin only** — run Cursor cloud agent on this repo |

### Admin: update the bot from Telegram

Only `TELEGRAM_ADMIN_USER_IDS` can use `/agent`. Requires `CURSOR_API_KEY` (Worker secret) and `CURSOR_AGENT_REPO_URL`.

```bash
wrangler secret put CURSOR_API_KEY
# optional vars in wrangler.jsonc: CURSOR_AGENT_REPO_URL, CURSOR_AGENT_REPO_REF, CURSOR_AGENT_MODEL
```

In the QA channel (as admin):

```
/agent help
/agent config repo https://github.com/your-org/TG-Trello-Agent
/agent Add browser field validation for Edge
```

The agent runs on Cursor’s cloud VM, edits the repo, and can open a PR if `CURSOR_AGENT_AUTO_PR=true`.

## Trello notifications (channel)

Webhooks are registered on **Support/Triage** and **Development** boards (`npm run setup:trello-webhook`).

When a card is:

- **Created** (Mini App) → channel + reporter tag + DM  
- **Assigned** → channel + reporter tag  
- **Left INBOX** → called out on list move  
- **Moved to Development board** → dedicated message  
- **DONE / archived** → channel + reporter tag + DM  

Set `TRELLO_DEV_BOARD_ID` in `.env` if your Development board name differs (script auto-detects names containing “Development”).

## Env vars

See `.env.example`. Key vars:

- `TELEGRAM_QA_CHAT_ID` — e.g. `-1003695636039`
- `WEBAPP_URL` — Worker URL (also in wrangler `vars`)
- `TRELLO_BOARD_ID`, `TRELLO_DONE_LIST_ID` — for webhooks

## Development

```bash
npm run dev
```

Open the Worker URL in Telegram Web App debugger or via @WLTH_Triage_Bot after `setup:menu`.
