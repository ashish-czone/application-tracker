import type { SettingsModuleDefinition } from '@packages/settings';
import { DEFAULT_SITE_THEME, type SiteTheme } from '@domains/agency-contract';

// Agency marketing site settings. Single `site` module covering both
// company identity (name, logo) and public-site branding (tagline,
// social, SEO, analytics). Kept as one bucket because the existing
// platform `general` module is scoped to localization (currency,
// timezone, formats) — not company identity. If another app later
// needs company identity, lift `companyName` plus the media
// references (`companyLogo`, `defaultSeo.ogImage`) into a shared
// `company` module with a one-line migration — the public endpoint
// already resolves the media UUIDs to URLs, so consumers of the
// public wire shape don't need to change.
//
// `theme`, `companyLogo`, and `defaultSeo.ogImage` are marked
// `hidden: true` so the generic settings admin page skips them — they
// are edited by the dedicated Appearance and Branding pages, which
// read/write via the same AppConfig module.
export const SITE_DEFAULTS = {
  companyName: 'Studio',
  companyLogo: '',
  siteName: 'Studio',
  tagline: 'Brand-first design and technology',
  description: 'A studio building thoughtful digital products.',
  contactEmail: 'hello@example.com',
  contactPhone: '',
  address: '',
  'social.twitter': '',
  'social.linkedin': '',
  'social.instagram': '',
  'social.github': '',
  'social.youtube': '',
  'defaultSeo.title': '',
  'defaultSeo.description': '',
  'defaultSeo.ogImage': '',
  'analytics.ga4': '',
  'analytics.posthog': '',
  theme: DEFAULT_SITE_THEME as SiteTheme,
} as const;

export const SITE_SETTINGS: SettingsModuleDefinition = {
  label: 'Site',
  defaults: { ...SITE_DEFAULTS },
  metadata: {
    companyName: {
      label: 'Company name',
      type: 'string',
      description: 'Legal entity name. Used in footer copyright and Organization schema.',
    },
    companyLogo: {
      label: 'Company logo',
      type: 'string',
      description: 'Media-library asset reference (UUID). Edited via the Branding page.',
      hidden: true,
    },
    siteName: {
      label: 'Site name',
      type: 'string',
      description: 'Public-facing brand name. Appears in the header, page titles, and structured data.',
    },
    tagline: {
      label: 'Tagline',
      type: 'string',
      description: 'Short positioning line. Appears under the site name in the footer.',
    },
    description: {
      label: 'Site description',
      type: 'string',
      description: 'One-paragraph description. Fallback meta description and Organization description.',
    },
    contactEmail: {
      label: 'Contact email',
      type: 'string',
      description: 'Primary contact address. Shown in the footer and used for mailto links.',
    },
    contactPhone: {
      label: 'Contact phone',
      type: 'string',
      description: 'E.164 phone number. Leave blank to omit from the footer.',
    },
    address: {
      label: 'Postal address',
      type: 'string',
      description: 'Full postal address for the footer. Newlines are preserved on render.',
    },
    'social.twitter': {
      label: 'X / Twitter URL',
      type: 'string',
      description: 'Full profile URL. Surfaces in the footer and Organization sameAs.',
    },
    'social.linkedin': {
      label: 'LinkedIn URL',
      type: 'string',
    },
    'social.instagram': {
      label: 'Instagram URL',
      type: 'string',
    },
    'social.github': {
      label: 'GitHub URL',
      type: 'string',
    },
    'social.youtube': {
      label: 'YouTube URL',
      type: 'string',
    },
    'defaultSeo.title': {
      label: 'Default SEO title',
      type: 'string',
      description: 'Fallback <title> when a page has none of its own. Composed as "{page} | {defaultTitle}".',
    },
    'defaultSeo.description': {
      label: 'Default SEO description',
      type: 'string',
    },
    'defaultSeo.ogImage': {
      label: 'Default Open Graph image',
      type: 'string',
      description: 'Media-library asset reference (UUID). Fallback social-share image, recommended 1200×630. Edited via the Branding page.',
      hidden: true,
    },
    'analytics.ga4': {
      label: 'Google Analytics 4 Measurement ID',
      type: 'string',
      description: 'e.g. G-XXXXXXXX. Leave blank to disable GA4.',
    },
    'analytics.posthog': {
      label: 'PostHog project API key',
      type: 'string',
      description: 'Public project API key. Leave blank to disable PostHog.',
    },
    theme: {
      label: 'Public site theme',
      type: 'string',
      description: 'Edited via the Appearance page, not this form.',
      hidden: true,
    },
  },
};

// Keys safe to expose via the public customer-portal endpoint. All
// current site fields are public-safe (even GA4/PostHog keys — they
// ship in HTML anyway), but we keep the allow-list explicit so adding
// a new setting never accidentally leaks a private key.
export const PUBLIC_SITE_KEYS = [
  'companyName',
  'companyLogo',
  'siteName',
  'tagline',
  'description',
  'contactEmail',
  'contactPhone',
  'address',
  'social.twitter',
  'social.linkedin',
  'social.instagram',
  'social.github',
  'social.youtube',
  'defaultSeo.title',
  'defaultSeo.description',
  'defaultSeo.ogImage',
  'analytics.ga4',
  'analytics.posthog',
  'theme',
] as const satisfies ReadonlyArray<keyof typeof SITE_DEFAULTS>;

export type SiteSettingKey = keyof typeof SITE_DEFAULTS;
