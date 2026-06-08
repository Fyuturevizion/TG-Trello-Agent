import type { ActiveProductCampaign, ProductPhase } from './types';
import type { Env } from '../types';

const ACTIVE_KEY = 'product:active';

export async function loadActiveProductCampaign(env: Env): Promise<ActiveProductCampaign | null> {
  const raw = await env.SESSIONS.get(ACTIVE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ActiveProductCampaign;
  } catch {
    return null;
  }
}

export async function saveActiveProductCampaign(
  env: Env,
  campaign: ActiveProductCampaign,
): Promise<void> {
  await env.SESSIONS.put(ACTIVE_KEY, JSON.stringify(campaign));
}

export async function clearActiveProductCampaign(env: Env): Promise<void> {
  await env.SESSIONS.delete(ACTIVE_KEY);
}

export async function startProductCampaign(
  env: Env,
  input: {
    slug: string;
    label: string;
    phase: ProductPhase;
    startedBy: number;
    startedByUsername?: string;
  },
): Promise<ActiveProductCampaign> {
  const campaign: ActiveProductCampaign = {
    slug: input.slug,
    label: input.label,
    phase: input.phase,
    startedAt: new Date().toISOString(),
    startedBy: input.startedBy,
    startedByUsername: input.startedByUsername,
  };
  await saveActiveProductCampaign(env, campaign);
  return campaign;
}

export async function setProductPhase(env: Env, phase: ProductPhase): Promise<ActiveProductCampaign | null> {
  const current = await loadActiveProductCampaign(env);
  if (!current) return null;
  const updated = { ...current, phase };
  await saveActiveProductCampaign(env, updated);
  return updated;
}
