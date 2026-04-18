const JURISDICTION_LABEL: Record<string, string> = {
  central: 'Central',
  state: 'State',
  municipal: 'Municipal',
  international: "Int'l",
};

export interface MutedJurisdictionTagProps {
  jurisdiction: string;
}

export function MutedJurisdictionTag({ jurisdiction }: MutedJurisdictionTagProps) {
  return (
    <span className="inline-block px-1.5 py-[1px] border border-rule text-[9px] font-sans font-semibold uppercase tracking-[0.14em] text-ink-muted bg-paper-raised">
      {JURISDICTION_LABEL[jurisdiction] ?? jurisdiction}
    </span>
  );
}
