# WLTH Product Agent — QA Triage

Telegram bot for the WLTH QA channel. Reporters submit bugs and wishlist items via a Mini App; cards land in Trello **Support/Triage → INBOX**, with updates posted back to the channel.

**Bot:** [@WLTH_Triage_Bot](https://t.me/WLTH_Triage_Bot)

## How to report

1. In the QA channel, tap **Report bug** or **Wishlist** on the pinned message  
2. Or use **`/report`**, **`/bug`**, or **`/wishlist`**  
3. Fill in the form and submit  

One channel message is posted per report. You’ll get updates when the card is picked up, assigned, moved, or completed.

## Commands

| Command | What it does |
|--------|----------------|
| `/report` | Open the report form |
| `/bug` | Open form (bug) |
| `/wishlist` | Open form (wishlist) |
| `/help` | Help |

## Admin

Admin-only: `/setup` (refresh channel buttons), `/master-splinter` (maintain this project).
`/master-splinter test-dm` — preview the “Please test this update” DM reporters get when a card moves to Mobile/PWA Review.

## Questions

Contact the triage admin in your QA channel.
