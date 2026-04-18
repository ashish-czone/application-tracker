export type GlobalSetKind = 'flat' | 'hierarchical';

export interface GlobalSetDefinition {
  slug: string;
  label: string;
  description: string;
  kind: GlobalSetKind;
  itemCount: number;
  usedByFields: number;
  updatedAt: string;
}

export interface GlobalSetItem {
  id: string;
  slug: string;
  label: string;
  parentSlug?: string;
  metadata?: Record<string, string>;
}

export const GLOBAL_SETS: GlobalSetDefinition[] = [
  {
    slug: 'countries',
    label: 'Countries',
    description: 'ISO 3166-1 country list. Used on client, user and jurisdiction fields.',
    kind: 'flat',
    itemCount: 249,
    usedByFields: 12,
    updatedAt: '2026-03-02',
  },
  {
    slug: 'industries',
    label: 'Industries',
    description: 'Two-level sector classification based on NIC codes.',
    kind: 'hierarchical',
    itemCount: 42,
    usedByFields: 4,
    updatedAt: '2026-02-18',
  },
  {
    slug: 'currencies',
    label: 'Currencies',
    description: 'ISO 4217 currencies with symbol and minor units.',
    kind: 'flat',
    itemCount: 168,
    usedByFields: 7,
    updatedAt: '2025-11-14',
  },
  {
    slug: 'languages',
    label: 'Languages',
    description: 'Supported UI and correspondence languages.',
    kind: 'flat',
    itemCount: 24,
    usedByFields: 3,
    updatedAt: '2025-09-06',
  },
  {
    slug: 'jurisdictions',
    label: 'Jurisdictions',
    description: 'Central, state and municipal regulatory jurisdictions.',
    kind: 'hierarchical',
    itemCount: 38,
    usedByFields: 9,
    updatedAt: '2026-03-28',
  },
];

export const GLOBAL_SET_ITEMS: Record<string, GlobalSetItem[]> = {
  countries: [
    { id: 'c-in', slug: 'IN', label: 'India', metadata: { ISO3: 'IND', Phone: '+91' } },
    { id: 'c-us', slug: 'US', label: 'United States', metadata: { ISO3: 'USA', Phone: '+1' } },
    { id: 'c-gb', slug: 'GB', label: 'United Kingdom', metadata: { ISO3: 'GBR', Phone: '+44' } },
    { id: 'c-ae', slug: 'AE', label: 'United Arab Emirates', metadata: { ISO3: 'ARE', Phone: '+971' } },
    { id: 'c-sg', slug: 'SG', label: 'Singapore', metadata: { ISO3: 'SGP', Phone: '+65' } },
    { id: 'c-de', slug: 'DE', label: 'Germany', metadata: { ISO3: 'DEU', Phone: '+49' } },
  ],
  industries: [
    { id: 'i-fs', slug: 'financial-services', label: 'Financial Services' },
    { id: 'i-fs-bank', slug: 'banking', label: 'Banking', parentSlug: 'financial-services' },
    { id: 'i-fs-insure', slug: 'insurance', label: 'Insurance', parentSlug: 'financial-services' },
    { id: 'i-fs-nbfc', slug: 'nbfc', label: 'NBFC', parentSlug: 'financial-services' },
    { id: 'i-mfg', slug: 'manufacturing', label: 'Manufacturing' },
    { id: 'i-mfg-auto', slug: 'automotive', label: 'Automotive', parentSlug: 'manufacturing' },
    { id: 'i-mfg-pharma', slug: 'pharmaceuticals', label: 'Pharmaceuticals', parentSlug: 'manufacturing' },
    { id: 'i-it', slug: 'technology', label: 'Technology' },
    { id: 'i-it-saas', slug: 'saas', label: 'SaaS', parentSlug: 'technology' },
  ],
  currencies: [
    { id: 'cur-inr', slug: 'INR', label: 'Indian Rupee', metadata: { Symbol: '₹', Minor: '2' } },
    { id: 'cur-usd', slug: 'USD', label: 'US Dollar', metadata: { Symbol: '$', Minor: '2' } },
    { id: 'cur-eur', slug: 'EUR', label: 'Euro', metadata: { Symbol: '€', Minor: '2' } },
    { id: 'cur-gbp', slug: 'GBP', label: 'Pound Sterling', metadata: { Symbol: '£', Minor: '2' } },
    { id: 'cur-aed', slug: 'AED', label: 'UAE Dirham', metadata: { Symbol: 'د.إ', Minor: '2' } },
  ],
  languages: [
    { id: 'l-en', slug: 'en', label: 'English' },
    { id: 'l-hi', slug: 'hi', label: 'Hindi' },
    { id: 'l-ar', slug: 'ar', label: 'Arabic' },
    { id: 'l-fr', slug: 'fr', label: 'French' },
  ],
  jurisdictions: [
    { id: 'j-central', slug: 'central', label: 'Central' },
    { id: 'j-central-mca', slug: 'mca', label: 'Ministry of Corporate Affairs', parentSlug: 'central' },
    { id: 'j-central-sebi', slug: 'sebi', label: 'SEBI', parentSlug: 'central' },
    { id: 'j-central-rbi', slug: 'rbi', label: 'RBI', parentSlug: 'central' },
    { id: 'j-state', slug: 'state', label: 'State' },
    { id: 'j-state-mh', slug: 'mh', label: 'Maharashtra', parentSlug: 'state' },
    { id: 'j-state-ka', slug: 'ka', label: 'Karnataka', parentSlug: 'state' },
    { id: 'j-municipal', slug: 'municipal', label: 'Municipal' },
  ],
};
