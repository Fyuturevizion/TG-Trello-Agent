export type ReportType = 'bug' | 'wishlist' | 'product';

export interface Env {
  ASSETS: Fetcher;
  SESSIONS: KVNamespace;
  TELEGRAM_BOT_TOKEN: string;
  /** @username without @ — used to detect unauthorized @tags. */
  TELEGRAM_BOT_USERNAME?: string;
  TELEGRAM_BOT_ID?: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  /** One or more QA supergroup IDs, comma-separated (e.g. -100111,-100222). */
  TELEGRAM_QA_CHAT_ID: string;
  /** Dojo keeper — only this user may run /dojo_grant with the secret word. */
  TELEGRAM_DOJO_KEEPER_ID?: string;
  /** Comma-separated Telegram user IDs allowed to use bot commands. */
  TELEGRAM_ALLOWED_USER_IDS?: string;
  /** Comma-separated Telegram user IDs denied bot access. */
  TELEGRAM_BLOCKED_USER_IDS?: string;
  /** Comma-separated Telegram usernames denied bot access (with or without @). */
  TELEGRAM_BLOCKED_USERNAMES?: string;
  /** Comma-separated IDs allowed to run admin commands (/setup, /master-splinter). */
  TELEGRAM_ADMIN_USER_IDS?: string;
  /** Comma-separated @usernames (no @) treated as admins when IDs are unset or unknown. */
  TELEGRAM_ADMIN_USERNAMES?: string;
  /** Secret word for /dojo_grant (Worker secret DOJO_ADMIN_SECRET). */
  DOJO_ADMIN_SECRET?: string;
  TRELLO_API_KEY: string;
  TRELLO_TOKEN: string;
  TRELLO_INBOX_LIST_ID: string;
  TRELLO_BOARD_NAME?: string;
  TRELLO_LABEL_BUG?: string;
  TRELLO_LABEL_IDEA?: string;
  TRELLO_LABEL_PRODUCT?: string;
  /** Product feedback queue (all phases) when phase lists are unset. */
  TRELLO_PRODUCT_LIST_ID?: string;
  TRELLO_PRODUCT_PHASE1_LIST_ID?: string;
  TRELLO_PRODUCT_PHASE2_LIST_ID?: string;
  TRELLO_PRODUCT_PHASE3_LIST_ID?: string;
  TRELLO_LABEL_IOS?: string;
  TRELLO_LABEL_ANDROID?: string;
  TRELLO_LABEL_WEB?: string;
  TRELLO_CUSTOM_FIELD_DEVICE?: string;
  /** Trello Device custom-field option id for "Native App" (both iOS and Android). */
  TRELLO_DEVICE_OPTION_NATIVE_APP?: string;
  TRELLO_CUSTOM_FIELD_ERC?: string;
  WEBHOOK_URL?: string;
  WEBAPP_URL?: string;
  TRELLO_BOARD_ID?: string;
  TRELLO_DONE_LIST_ID?: string;
  /** Comma-separated list ids that trigger a test request DM to the reporter. */
  TRELLO_REVIEW_LIST_IDS?: string;
  /** Board id when cards move off Support/Triage (e.g. Development). */
  TRELLO_DEV_BOARD_ID?: string;
  /** Comma-separated list ids treated as archived/closed (optional, no Telegram announce). */
  TRELLO_ARCHIVE_LIST_IDS?: string;
  SESSION_TTL_SECONDS?: string;
  MAX_PHOTOS?: string;
  /** Cursor Cloud Agents API key (admin /master-splinter commands). */
  CURSOR_API_KEY?: string;
  CURSOR_AGENT_REPO_URL?: string;
  CURSOR_AGENT_REPO_REF?: string;
  CURSOR_AGENT_MODEL?: string;
  /** Set to "true" to open PRs when the cloud agent finishes. */
  CURSOR_AGENT_AUTO_PR?: string;
  /** Set to "false" to disable fast mode (default: fast on). */
  CURSOR_AGENT_FAST?: string;
  /** Prompts before rotating to a fresh agent session (default 8). */
  CURSOR_AGENT_MAX_SESSION_PROMPTS?: string;

  /** Slack Sensei — separate from TG Splinter; see src/slack-sensei/ */
  SLACK_BOT_TOKEN?: string;
  SLACK_SIGNING_SECRET?: string;
  /** Channel ID for Sentry alerts (e.g. C01234567). */
  SLACK_SENSEI_CHANNEL_ID?: string;
  /** Path secret for POST /slack-sensei/sentry/:secret */
  SENTRY_WEBHOOK_SECRET?: string;
  /** Optional Trello list for Sensei cards; defaults to TRELLO_INBOX_LIST_ID. */
  TRELLO_SENSEI_LIST_ID?: string;
}

export interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
  is_bot?: boolean;
}

export interface TelegramChat {
  id: number;
  type: string;
}

export interface TelegramMessageEntity {
  type: string;
  offset: number;
  length: number;
  user?: TelegramUser;
}

export interface TelegramMessage {
  message_id: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
  caption?: string;
  entities?: TelegramMessageEntity[];
  caption_entities?: TelegramMessageEntity[];
  photo?: Array<{ file_id: string; file_unique_id: string }>;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  bug: 'Bug',
  wishlist: 'Wishlist',
  product: 'Product feedback',
};
