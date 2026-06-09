import type { Env } from '../types';
import { isProductAreaId } from './areas';

const ACTIVE_KEY = 'product:active';
const TTL_SECONDS = 180 * 24 * 60 * 60;

export interface ProductCampaign {
  slug: string;
  displayName: string;
  cardId: string;
  shortUrl: string;
  /** One Trello checklist per product area. */
  checklistIds: Record<string, string>;
  /** @deprecated Legacy campaigns used a single checklist. */
  checklistId?: string;
  openedAt: string;
  openedBy: number;
  open: boolean;
  feedbackCount: number;
}

export function slugToDisplayName(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function normalizeProductSlug(raw: string): string | null {
  const slug = raw.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug || slug.length > 48) return null;
  return slug;
}

export function checklistIdForArea(campaign: ProductCampaign, area: string): string | null {
  if (isProductAreaId(area) && campaign.checklistIds?.[area]) {
    return campaign.checklistIds[area];
  }
  return campaign.checklistId ?? null;
}

function hasChecklists(campaign: ProductCampaign): boolean {
  if (campaign.checklistId) return true;
  const ids = campaign.checklistIds;
  return Boolean(ids && Object.keys(ids).length > 0);
}

export async function loadActiveProduct(env: Env): Promise<ProductCampaign | null> {
  const raw = await env.SESSIONS.get(ACTIVE_KEY);
  if (!raw) return null;
  try {
    const campaign = JSON.parse(raw) as ProductCampaign;
    if (!campaign.open || !campaign.cardId || !hasChecklists(campaign)) return null;
    return campaign;
  } catch {
    return null;
  }
}

export async function saveActiveProduct(env: Env, campaign: ProductCampaign): Promise<void> {
  await env.SESSIONS.put(ACTIVE_KEY, JSON.stringify(campaign), {
    expirationTtl: TTL_SECONDS,
  });
}

export async function clearActiveProduct(env: Env): Promise<void> {
  await env.SESSIONS.delete(ACTIVE_KEY);
}

export async function incrementProductFeedbackCount(env: Env): Promise<number> {
  const campaign = await loadActiveProduct(env);
  if (!campaign) return 0;
  campaign.feedbackCount = (campaign.feedbackCount ?? 0) + 1;
  await saveActiveProduct(env, campaign);
  return campaign.feedbackCount;
}
