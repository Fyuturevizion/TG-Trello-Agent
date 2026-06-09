/** Feature areas — each gets its own checklist on the product hub card. */
export const PRODUCT_AREAS = [
  { id: 'merge', label: 'Merge / Slice', hint: 'Slice merge flows', icon: '🔀' },
  { id: 'listings', label: 'Listings', hint: 'Create & edit listings', icon: '📋' },
  { id: 'basket', label: 'Basket / Cart', hint: 'Cart & checkout', icon: '🛒' },
  { id: 'sweep', label: 'Sweep / Auto-swap', hint: 'Batch buy & swap', icon: '⚡' },
  { id: 'search', label: 'Search & discovery', hint: 'Find & filter', icon: '🔍' },
  { id: 'bid', label: 'Bidding', hint: 'Bid & fractional', icon: '🎯' },
  { id: 'auth', label: 'Login / account', hint: 'Sign-in & profile', icon: '🔐' },
  { id: 'other', label: 'Other', hint: 'Anything else', icon: '💬' },
] as const;

export type ProductAreaId = (typeof PRODUCT_AREAS)[number]['id'];

const AREA_MAP = new Map(PRODUCT_AREAS.map((a) => [a.id, a.label]));

export function isProductAreaId(value: string): value is ProductAreaId {
  return AREA_MAP.has(value as ProductAreaId);
}

export function productAreaLabel(id: string): string {
  return AREA_MAP.get(id as ProductAreaId) ?? id;
}
