import { nextMeditationQuote } from './meditation-quotes';
import { escapeHtml } from '../telegram-format';
import {
  deleteMessage,
  editMessageText,
  sendChatAction,
  sendMessage,
} from '../telegram';
import type { Env } from '../types';

const SPINNER = ['◴', '◷', '◶', '◵'];

export type SplinterStreamState = {
  toolName?: string;
  runStatus?: string;
};

const TYPING_INTERVAL_MS = 4500;
const MEDITATION_INTERVAL_MS = 7500;
const TOOL_LABEL_MAX_MS = 14_000;
const MIN_EDIT_INTERVAL_MS = 1100;
const MAX_STATUS_QUOTE_CHARS = 72;

function truncateQuote(text: string): string {
  const t = text.trim();
  if (t.length <= MAX_STATUS_QUOTE_CHARS) return t;
  return `${t.slice(0, MAX_STATUS_QUOTE_CHARS - 1)}…`;
}

/** Single-line activity status (the “loading / reasoning” line under the name). */
function formatPresence(tick: number, state: SplinterStreamState, statusQuote: string): string {
  const icon = SPINNER[tick % SPINNER.length];
  const tool = state.toolName?.trim();
  const subtitle = tool
    ? `Walking the path · ${escapeHtml(tool)}`
    : `<i>"${escapeHtml(truncateQuote(statusQuote))}"</i>`;

  return `${icon} <b>Master Splinter</b> · ${subtitle}`;
}

export class SplinterPresence {
  private tick = 0;
  private meditation = nextMeditationQuote();
  private state: SplinterStreamState = {};
  private stopped = false;
  private lastEditAt = 0;
  private pendingEdit: ReturnType<typeof setTimeout> | null = null;
  private messageId = 0;
  private typingTimer: ReturnType<typeof setInterval> | null = null;
  private frameTimer: ReturnType<typeof setInterval> | null = null;
  private meditationTimer: ReturnType<typeof setInterval> | null = null;
  private toolClearTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly env: Env,
    private readonly chatId: number,
  ) {}

  private rotateQuote(): void {
    this.meditation = nextMeditationQuote(this.meditation);
  }

  private clearToolLabel(): void {
    if (this.toolClearTimer) {
      clearTimeout(this.toolClearTimer);
      this.toolClearTimer = null;
    }
    delete this.state.toolName;
    this.rotateQuote();
    this.scheduleEdit();
  }

  getMessageId(): number {
    return this.messageId;
  }

  async start(): Promise<void> {
    await sendChatAction(this.env, this.chatId, 'typing');
    const msg = await sendMessage(
      this.env,
      this.chatId,
      formatPresence(0, this.state, this.meditation),
      { parseMode: 'HTML' },
    );
    this.messageId = msg.message_id;

    this.typingTimer = setInterval(() => {
      if (!this.stopped) void sendChatAction(this.env, this.chatId, 'typing').catch(() => {});
    }, TYPING_INTERVAL_MS);

    this.frameTimer = setInterval(() => {
      if (this.stopped) return;
      this.tick += 1;
      void this.flushEdit();
    }, 2200);

    this.meditationTimer = setInterval(() => {
      if (this.stopped) return;
      this.rotateQuote();
      void this.flushEdit();
    }, MEDITATION_INTERVAL_MS);
  }

  /** Stream events refresh quotes — never show raw reasoning text. */
  pushStream(
    patch: Partial<SplinterStreamState> & {
      thinking?: string;
      assistant?: string;
      toolDone?: boolean;
    },
  ): void {
    if (patch.runStatus !== undefined) this.state.runStatus = patch.runStatus;

    if (patch.toolDone || patch.toolName === '') {
      this.clearToolLabel();
    } else if (patch.toolName !== undefined) {
      this.state.toolName = patch.toolName;
      if (this.toolClearTimer) clearTimeout(this.toolClearTimer);
      this.toolClearTimer = setTimeout(() => this.clearToolLabel(), TOOL_LABEL_MAX_MS);
    }

    // Never surface stream thinking/assistant text — only refresh the spinner frame.
    this.scheduleEdit();
  }

  private scheduleEdit(): void {
    const now = Date.now();
    const wait = Math.max(0, MIN_EDIT_INTERVAL_MS - (now - this.lastEditAt));
    if (this.pendingEdit) clearTimeout(this.pendingEdit);
    this.pendingEdit = setTimeout(() => {
      this.pendingEdit = null;
      void this.flushEdit();
    }, wait);
  }

  private async flushEdit(): Promise<void> {
    if (this.stopped || !this.messageId) return;
    this.lastEditAt = Date.now();
    try {
      await editMessageText(
        this.env,
        this.chatId,
        this.messageId,
        formatPresence(this.tick, this.state, this.meditation),
        undefined,
        'HTML',
      );
    } catch {
      // flood limit or message unchanged
    }
  }

  private stopTimers(): void {
    this.stopped = true;
    if (this.pendingEdit) clearTimeout(this.pendingEdit);
    if (this.toolClearTimer) clearTimeout(this.toolClearTimer);
    if (this.typingTimer) clearInterval(this.typingTimer);
    if (this.frameTimer) clearInterval(this.frameTimer);
    if (this.meditationTimer) clearInterval(this.meditationTimer);
  }

  /** Run still going — leave a status line instead of vanishing mid-meditation. */
  async showPendingHint(): Promise<void> {
    this.stopTimers();
    if (!this.messageId) return;
    try {
      await editMessageText(
        this.env,
        this.chatId,
        this.messageId,
        '◌ <b>Master Splinter</b> · Still on the mat. Send <code>/master_splinter status</code> for my answer.',
        undefined,
        'HTML',
      );
    } catch {
      // message gone
    }
  }

  /** Remove meditation UI only after the real reply was posted. */
  async finish(): Promise<void> {
    this.stopTimers();
    if (!this.messageId) return;
    try {
      await deleteMessage(this.env, this.chatId, this.messageId);
    } catch {
      // already removed
    }
  }
}
