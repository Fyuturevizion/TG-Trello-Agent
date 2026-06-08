import type { Env } from './types';

export type ProductFeatureStatus = 'live' | 'preview' | 'coming_soon';

export interface ProductFeatureArea {
  id: string;
  label: string;
  status: ProductFeatureStatus;
  note?: string;
}

export interface ProductFeedbackType {
  id: string;
  label: string;
}

export interface ProductDefinition {
  slug: string;
  displayName: string;
  summary: string;
  featureAreas: ProductFeatureArea[];
}

export interface ProductRecord {
  slug: string;
  displayName: string;
  cardId: string;
  shortUrl: string;
  checklistId: string;
  active: boolean;
  launchedAt: string;
  launchedBy: number;
}

export const PRODUCT_FEEDBACK_TYPES: ProductFeedbackType[] = [
  { id: 'bug', label: 'Something broken' },
  { id: 'confusing', label: 'Confusing / hard to use' },
  { id: 'suggestion', label: 'Suggestion' },
  { id: 'praise', label: 'Works well' },
];

export const PRODUCT_FEEDBACK_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  PRODUCT_FEEDBACK_TYPES.map((t) => [t.id, t.label]),
);

const MARKETPLACE_FEATURES: ProductFeatureArea[] = [
  {
    id: 'fund_slice_merge',
    label: 'Fund Slice Merge',
    status: 'live',
    note: 'Portfolio → Slices. Select slices, merge, new slice equals combined value.',
  },
  {
    id: 'on_chain_listings',
    label: 'Marketplace Listings (On-Chain)',
    status: 'live',
    note: 'Listings from contract, enriched with usernames, avatars, fund names, valuation.',
  },
  {
    id: 'basket_cart',
    label: 'Basket / Cart',
    status: 'live',
    note: 'Add to basket, guest cart, authenticated sync, validation, batchBuyNFT checkout.',
  },
  {
    id: 'sweep_bulk',
    label: 'Sweep / Bulk Buying',
    status: 'live',
    note: 'Select by floor/discount, max price, auto-swap if slice sells.',
  },
  {
    id: 'search_filters',
    label: 'Search, Filters, Favourites, Quick View',
    status: 'live',
    note: 'Blockchain search, advanced filters, watchlist, quick-view, collection stats.',
  },
  {
    id: 'bid',
    label: 'Bid',
    status: 'preview',
    note: 'Contract built. Bid, update, cancel, seller accept. App-dev deploy pending.',
  },
  {
    id: 'fractional_bid',
    label: 'Fractional Bid (% of slice)',
    status: 'coming_soon',
    note: 'Bid on part of a larger slice. Sale completes, NFT fractionalises, new token IDs.',
  },
];

const MARKETPLACE_SUMMARY = [
  'Major Marketplace build feedback lands on this card as checklist items.',
  '',
  '**Live areas:** Fund Slice Merge, On-Chain Listings, Basket/Cart, Sweep/Bulk Buy, Search & Filters.',
  '**Preview:** Bid (contract ready, app-dev deploy pending).',
  '**Coming soon:** Fractional bid on a percentage of a slice.',
].join('\n');

export const PRODUCT_DEFINITIONS: Record<string, ProductDefinition> = {
  marketplace: {
    slug: 'marketplace',
    displayName: 'Marketplace',
    summary: MARKETPLACE_SUMMARY,
    featureAreas: MARKETPLACE_FEATURES,
  },
};

function productKvKey(slug: string): string {
  return `product:${slug}`;
}

export function normalizeProductSlug(raw: string): string | null {
  const slug = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!slug || slug.length > 48) return null;
  return slug;
}

export function getProductDefinition(slug: string): ProductDefinition | null {
  return PRODUCT_DEFINITIONS[slug] ?? null;
}

export function listKnownProductSlugs(): string[] {
  return Object.keys(PRODUCT_DEFINITIONS);
}

export async function getProductRecord(env: Env, slug: string): Promise<ProductRecord | null> {
  const raw = await env.SESSIONS.get(productKvKey(slug));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ProductRecord;
  } catch {
    return null;
  }
}

export async function saveProductRecord(env: Env, record: ProductRecord): Promise<void> {
  await env.SESSIONS.put(productKvKey(record.slug), JSON.stringify(record));
}

export async function listActiveProducts(env: Env): Promise<ProductRecord[]> {
  const active: ProductRecord[] = [];
  for (const slug of listKnownProductSlugs()) {
    const record = await getProductRecord(env, slug);
    if (record?.active) active.push(record);
  }
  return active;
}

export function featureAreaLabel(definition: ProductDefinition, featureId: string): string | null {
  return definition.featureAreas.find((f) => f.id === featureId)?.label ?? null;
}

export function isValidFeatureArea(definition: ProductDefinition, featureId: string): boolean {
  return definition.featureAreas.some((f) => f.id === featureId);
}

export function isValidFeedbackType(feedbackType: string): boolean {
  return PRODUCT_FEEDBACK_TYPES.some((t) => t.id === feedbackType);
}

export function buildProductParentCardDescription(definition: ProductDefinition): string {
  const lines = [
    `# ${definition.displayName} — Product Feedback`,
    '',
    definition.summary,
    '',
    '## Feature areas',
  ];

  for (const feature of definition.featureAreas) {
    const statusLabel =
      feature.status === 'live'
        ? 'Live'
        : feature.status === 'preview'
          ? 'Preview'
          : 'Coming soon';
    lines.push(`- **${feature.label}** (${statusLabel})`);
    if (feature.note) lines.push(`  ${feature.note}`);
  }

  lines.push('', '---', 'Submissions from Telegram append to the **Feedback** checklist below.');
  return lines.join('\n');
}
