/**
 * UI-facing categorisation of compliance laws by tax / labour / corporate
 * domain. Used by the ComplianceRulesPage law-group filter and by row
 * display. Shared between the API (server-side filter expansion) and the
 * UI (badge + dropdown labels) so the mapping doesn't drift.
 *
 * The mapping is intentionally small and stable. Adding a new entry is
 * the *only* way the bucket of "GST" rules grows on screen — code changes
 * alone don't reclassify existing data.
 */
export const LAW_GROUP_KEYS = ['gst', 'itr', 'tds', 'roc', 'pt', 'pf', 'labour'] as const;
export type LawGroupKey = (typeof LAW_GROUP_KEYS)[number];

export const LAW_CODE_TO_GROUP: Readonly<Record<string, LawGroupKey>> = {
  GST: 'gst',
  IT: 'itr',
  ITR: 'itr',
  TDS: 'tds',
  ROC: 'roc',
  PT: 'pt',
  EPF: 'pf',
  ESI: 'pf',
  PF: 'pf',
};

const GROUP_TO_CODES: Record<LawGroupKey, string[]> = {
  gst: [],
  itr: [],
  tds: [],
  roc: [],
  pt: [],
  pf: [],
  labour: [],
};
for (const [code, group] of Object.entries(LAW_CODE_TO_GROUP)) {
  GROUP_TO_CODES[group].push(code);
}

/**
 * Inverse of `LAW_CODE_TO_GROUP`: given one or more group keys, returns the
 * union of law codes that fall in those groups. Used by the rules list
 * filter to translate `lawGroup=gst,itr` into a `lawCode IN (…)` predicate.
 */
export function lawCodesForGroups(groups: ReadonlyArray<LawGroupKey>): string[] {
  const set = new Set<string>();
  for (const g of groups) {
    for (const code of GROUP_TO_CODES[g] ?? []) set.add(code);
  }
  return [...set];
}

export function inferLawGroup(lawCode: string | null | undefined): LawGroupKey {
  if (!lawCode) return 'gst';
  return LAW_CODE_TO_GROUP[lawCode.toUpperCase()] ?? 'gst';
}
