import type { ProductPhase } from './types';
import type { Env } from '../types';

function parseListId(raw: string | undefined): string | undefined {
  const id = raw?.trim();
  return id || undefined;
}

/** Trello list for product feedback by QA phase. Falls back through phases then INBOX. */
export function resolveProductListId(env: Env, phase: ProductPhase): string {
  const phaseLists: Record<ProductPhase, string | undefined> = {
    1: parseListId(env.TRELLO_PRODUCT_PHASE1_LIST_ID),
    2: parseListId(env.TRELLO_PRODUCT_PHASE2_LIST_ID),
    3: parseListId(env.TRELLO_PRODUCT_PHASE3_LIST_ID),
  };

  const exact = phaseLists[phase];
  if (exact) return exact;

  // Fall back to nearest configured phase list, then shared product queue, then INBOX.
  for (const p of [phase, 2, 1, 3] as ProductPhase[]) {
    const id = phaseLists[p];
    if (id) return id;
  }

  const shared = parseListId(env.TRELLO_PRODUCT_LIST_ID);
  if (shared) return shared;

  return env.TRELLO_INBOX_LIST_ID;
}

export function productListLabel(env: Env, phase: ProductPhase): string {
  const phaseLists: Record<ProductPhase, string | undefined> = {
    1: parseListId(env.TRELLO_PRODUCT_PHASE1_LIST_ID),
    2: parseListId(env.TRELLO_PRODUCT_PHASE2_LIST_ID),
    3: parseListId(env.TRELLO_PRODUCT_PHASE3_LIST_ID),
  };
  if (phaseLists[phase]) return `Product QA · Phase ${phase}`;
  if (parseListId(env.TRELLO_PRODUCT_LIST_ID)) return 'Product QA';
  return 'INBOX (product queue not configured, using INBOX)';
}
