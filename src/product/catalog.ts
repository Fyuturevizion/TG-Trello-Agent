import type { ProductDefinition, ProductPhase } from './types';

export const PRODUCT_CATALOG: Record<string, ProductDefinition> = {
  marketplace: {
    slug: 'marketplace',
    label: 'Marketplace',
    summary:
      'Fund slice merge, on-chain listings, basket/cart, sweep buying, discovery, and bidding.',
    phases: [
      {
        phase: 1,
        title: 'Core flows',
        goal:
          'Smoke test fund slice merge, on-chain listing accuracy, and basic basket add. Can reporters complete merge, list, and buy happy paths?',
      },
      {
        phase: 2,
        title: 'Cart and discovery',
        goal:
          'Full basket flow (guest cart, auth sync, validation, batch buy), sweep/bulk buying with auto-swap, plus search, filters, favourites, and quick view.',
      },
      {
        phase: 3,
        title: 'Bids and sign-off',
        goal:
          'Bidding flows, fractional bid readiness, polish (e.g. merge tickbox contrast), and pre-release sign-off.',
      },
    ],
    featureAreas: [
      { id: 'fund_slice_merge', label: 'Fund slice merge' },
      { id: 'listings_on_chain', label: 'On-chain listings' },
      { id: 'basket_cart', label: 'Basket / cart' },
      { id: 'sweep_bulk', label: 'Sweep / bulk buy' },
      { id: 'search_filters', label: 'Search, filters, favourites' },
      { id: 'bid', label: 'Bidding' },
      { id: 'other', label: 'Other' },
    ],
  },
};

export function getProductDefinition(slug: string): ProductDefinition | undefined {
  return PRODUCT_CATALOG[slug.trim().toLowerCase()];
}

export function listProductSlugs(): string[] {
  return Object.keys(PRODUCT_CATALOG);
}

export function phaseGoal(def: ProductDefinition, phase: ProductPhase) {
  return def.phases.find((p) => p.phase === phase);
}
