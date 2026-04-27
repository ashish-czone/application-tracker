import type { LawGroup } from './types';

// Filter options + taxonomy for the compliance-rules registry view.
// Static config (today) — `LAW_GROUPS` may eventually come from the API,
// but the keyset is stable.

export type JurisdictionKey = 'central' | 'state' | 'municipal';

export const JURISDICTION_OPTIONS: { value: JurisdictionKey; label: string }[] = [
  { value: 'central', label: 'Central' },
  { value: 'state', label: 'State' },
  { value: 'municipal', label: 'Municipal' },
];

export const LAW_GROUPS: LawGroup[] = [
  { key: 'gst', label: 'Goods & Services Tax', jurisdiction: 'central', count: 12 },
  { key: 'itr', label: 'Income Tax', jurisdiction: 'central', count: 8 },
  { key: 'tds', label: 'TDS / TCS', jurisdiction: 'central', count: 6 },
  { key: 'roc', label: 'Registrar of Companies', jurisdiction: 'central', count: 6 },
  { key: 'pt', label: 'Professional Tax', jurisdiction: 'state', count: 3 },
  { key: 'pf', label: 'EPF & ESI', jurisdiction: 'central', count: 4 },
  { key: 'labour', label: 'Labour welfare', jurisdiction: 'state', count: 7 },
];
