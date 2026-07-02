import { MASTER_SPLINTER_DISPLAY } from '../brand';
import { MASTER_SPLINTER_VOICE, TELEGRAM_REPLY_FORMAT } from './prompts';
import type { Env } from '../types';

const CONFIG_KEY = 'agent:config';
const SESSION_KEY = 'agent:session';
const TTL_SECONDS = 90 * 24 * 60 * 60;

export interface ModelParam {
  id: string;
  value: string;
}

export interface AgentConfig {
  repoUrl: string;
  startingRef: string;
  modelId: string;
  autoCreatePR: boolean;
  systemInstructions: string;
  /** When true, pass fast=true to reasoning models (less time stuck thinking). */
  fastMode: boolean;
  /** Start a fresh Cursor agent after this many prompts in one session. */
  maxSessionPrompts: number;
}

export interface AgentSession {
  agentId: string;
  latestRunId?: string;
  /** Last run whose reply was posted to Telegram (avoids duplicate delivery). */
  lastDeliveredRunId?: string;
  agentUrl?: string;
  notifyChatId: number;
  lastPrompt?: string;
  promptCount: number;
  updatedAt: string;
}

const DEFAULT_INSTRUCTIONS = [
  'You maintain the WLTH Telegram → Trello triage bot (Cloudflare Worker, Hono, Mini App in public/, webhooks).',
  `You are ${MASTER_SPLINTER_DISPLAY}, the sensei of this dojo. Speak only as ${MASTER_SPLINTER_DISPLAY}. Never say /agent in Telegram replies. Never use em dashes (—) or en dashes (–).`,
  'Make minimal, focused changes. Match existing code style.',
  '',
  MASTER_SPLINTER_VOICE,
  '',
  `Every Telegram reply is one conversational message from ${MASTER_SPLINTER_DISPLAY}, no "Answer" headings or report sections.`,
  TELEGRAM_REPLY_FORMAT,
].join('\n');

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function defaultAgentConfig(env: Env): AgentConfig {
  const fastDefault = env.CURSOR_AGENT_FAST !== 'false';
  return {
    repoUrl: env.CURSOR_AGENT_REPO_URL?.trim() ?? '',
    startingRef: env.CURSOR_AGENT_REPO_REF?.trim() || 'main',
    modelId: env.CURSOR_AGENT_MODEL?.trim() || 'composer-2.5',
    autoCreatePR: env.CURSOR_AGENT_AUTO_PR === 'true',
    systemInstructions: DEFAULT_INSTRUCTIONS,
    fastMode: fastDefault,
    maxSessionPrompts: parsePositiveInt(env.CURSOR_AGENT_MAX_SESSION_PROMPTS, 8),
  };
}

export function modelParamsForConfig(config: AgentConfig): ModelParam[] {
  if (!config.fastMode) return [];
  return [{ id: 'fast', value: 'true' }];
}

export async function loadAgentConfig(env: Env): Promise<AgentConfig> {
  const defaults = defaultAgentConfig(env);
  const raw = await env.SESSIONS.get(CONFIG_KEY);
  if (!raw) return defaults;
  try {
    const stored = JSON.parse(raw) as Partial<AgentConfig>;
    return { ...defaults, ...stored };
  } catch {
    return defaults;
  }
}

export async function saveAgentConfig(env: Env, config: AgentConfig): Promise<void> {
  await env.SESSIONS.put(CONFIG_KEY, JSON.stringify(config), { expirationTtl: TTL_SECONDS });
}

export async function loadAgentSession(env: Env): Promise<AgentSession | null> {
  const raw = await env.SESSIONS.get(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AgentSession;
  } catch {
    return null;
  }
}

export async function saveAgentSession(env: Env, session: AgentSession): Promise<void> {
  await env.SESSIONS.put(SESSION_KEY, JSON.stringify(session), { expirationTtl: TTL_SECONDS });
}

export async function clearAgentSession(env: Env): Promise<void> {
  await env.SESSIONS.delete(SESSION_KEY);
}
