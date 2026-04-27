// Hierarchy node for the laws library tree view. The real screen reads
// the flat list of laws via `useLawsList` and then composes a tree
// client-side using parentId — see `mapLawRecord.ts`.
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
