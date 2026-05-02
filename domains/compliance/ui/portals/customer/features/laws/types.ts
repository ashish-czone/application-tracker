// Hierarchy node for the laws library tree view. The real screen reads
// the server-built tree via `lawsQueries(apiFn).tree()` — see
// `mapLawRecord.ts` for the API → UI mapping.
export type LawJurisdiction = 'central' | 'state' | 'municipal' | 'international';

export interface LawNode {
  id: string;
  citation: string;
  title: string;
  jurisdiction: LawJurisdiction;
  effectiveFrom?: string;
  obligationCount?: number;
  children?: LawNode[];
}
