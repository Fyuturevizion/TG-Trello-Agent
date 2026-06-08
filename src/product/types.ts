export type ProductPhase = 1 | 2 | 3;

export type ProductFeatureArea =
  | 'fund_slice_merge'
  | 'listings_on_chain'
  | 'basket_cart'
  | 'sweep_bulk'
  | 'search_filters'
  | 'bid'
  | 'other';

export interface ProductPhaseGoal {
  phase: ProductPhase;
  title: string;
  goal: string;
}

export interface ProductDefinition {
  slug: string;
  label: string;
  summary: string;
  phases: ProductPhaseGoal[];
  featureAreas: { id: ProductFeatureArea; label: string }[];
}

export interface ActiveProductCampaign {
  slug: string;
  label: string;
  phase: ProductPhase;
  startedAt: string;
  startedBy: number;
  startedByUsername?: string;
}

export const PRODUCT_FEATURE_AREA_LABELS: Record<ProductFeatureArea, string> = {
  fund_slice_merge: 'Fund slice merge',
  listings_on_chain: 'On-chain listings',
  basket_cart: 'Basket / cart',
  sweep_bulk: 'Sweep / bulk buy',
  search_filters: 'Search, filters, favourites',
  bid: 'Bidding',
  other: 'Other',
};
