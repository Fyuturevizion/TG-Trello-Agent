import type { DeviceKey } from './devices';

export type ReportType = 'bug' | 'wishlist';

export type FlowState =
  | 'idle'
  | 'type'
  | 'device'
  | 'pick_title'
  | 'title'
  | 'details'
  | 'erc'
  | 'erc_input'
  | 'photos'
  | 'confirm';

export interface Session {
  state: FlowState;
  type?: ReportType;
  device?: DeviceKey;
  title?: string;
  details?: string;
  ercAddress?: string;
  photoFileIds: string[];
  promptMessageId?: number;
}

export interface Env {
  ASSETS: Fetcher;
  SESSIONS: KVNamespace;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  TELEGRAM_QA_CHAT_ID: string;
  /** Comma-separated Telegram user IDs allowed to use bot commands. */
  TELEGRAM_ALLOWED_USER_IDS?: string;
  /** Comma-separated Telegram user IDs denied bot access. */
  TELEGRAM_BLOCKED_USER_IDS?: string;
  /** Comma-separated Telegram usernames denied bot access (with or without @). */
  TELEGRAM_BLOCKED_USERNAMES?: string;
  /** Comma-separated IDs allowed to run admin commands (/setup, /master-splinter). */
  TELEGRAM_ADMIN_USER_IDS?: string;
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
}

export interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
}

export interface TelegramMessage {
  message_id: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
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
