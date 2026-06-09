/** Feature areas reporters can tag feedback against (not phased — all available at once). */
export const PRODUCT_AREAS = [
  { id: 'merge', label: 'Merge / Slice' },
  { id: 'listings', label: 'Listings' },
  { id: 'basket', label: 'Basket / Cart' },
  { id: 'sweep', label: 'Sweep / Auto-swap' },
  { id: 'search', label: 'Search & discovery' },
  { id: 'bid', label: 'Bidding' },
  { id: 'auth', label: 'Login / account' },
  { id: 'other', label: 'Other' },
] as const;

export type ProductAreaId = (typeof PRODUCT_AREAS)[number]['id'];

const AREA_MAP = new Map(PRODUCT_AREAS.map((a) => [a.id, a.label]));

export function isProductAreaId(value: string): value is ProductAreaId {
  return AREA_MAP.has(value as ProductAreaId);
}

export function productAreaLabel(id: string): string {
  return AREA_MAP.get(id as ProductAreaId) ?? id;
}
