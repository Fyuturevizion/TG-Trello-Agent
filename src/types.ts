export type ReportType = 'bug' | 'wishlist';

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
  /** Comma-separated fixed admins (Worker secret). No fallback list. */
  TELEGRAM_ADMIN_USER_IDS?: string;
  /** Secret word for /dojo_grant (Worker secret DOJO_ADMIN_SECRET). */
  DOJO_ADMIN_SECRET?: string;
  TRELLO_API_KEY: string;
  TRELLO_TOKEN: string;
  TRELLO_INBOX_LIST_ID: string;
  TRELLO_BOARD_NAME?: string;
  TRELLO_LABEL_BUG?: string;
  TRELLO_LABEL_IDEA?: string;
  TRELLO_LABEL_IOS?: string;
  TRELLO_LABEL_ANDROID?: string;
  TRELLO_LABEL_WEB?: string;
  TRELLO_CUSTOM_FIELD_DEVICE?: string;
  TRELLO_CUSTOM_FIELD_ERC?: string;
  WEBHOOK_URL?: string;
  WEBAPP_URL?: string;
  TRELLO_BOARD_ID?: string;
  TRELLO_DONE_LIST_ID?: string;
  /** Board id when cards move off Support/Triage (e.g. Development). */
  TRELLO_DEV_BOARD_ID?: string;
  /** Comma-separated list ids treated as archived/closed (optional). */
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
};
