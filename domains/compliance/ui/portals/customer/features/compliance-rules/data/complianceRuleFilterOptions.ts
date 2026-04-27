export type JurisdictionKey = 'central' | 'state' | 'municipal';

export const JURISDICTION_OPTIONS: { value: JurisdictionKey; label: string }[] = [
  { value: 'central', label: 'Central' },
  { value: 'state', label: 'State' },
  { value: 'municipal', label: 'Municipal' },
];
