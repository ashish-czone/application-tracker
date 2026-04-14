// Shared compliance vocabulary used across composite widgets and the
// console preview. Kept minimal — real data types live in the API package.

export type LawCode = 'GST' | 'ITR' | 'TDS' | 'AUD' | 'ROC' | 'PT' | 'PF' | 'ESI';

export interface Law {
  id: string;
  code: LawCode | string;
  name: string;
  jurisdiction: 'central' | 'state' | 'municipal' | 'international';
  issuingAuthority: string;
  locality?: string;
  effectiveFrom?: string;
}

export interface Client {
  id: string;
  name: string;
  legalName?: string;
  taxIdentifier?: string;
  initials: string;
  color?: string;
}

export interface Handler {
  id: string;
  name: string;
  initials: string;
  role?: string;
}

export interface Filing {
  id: string;
  clientId: string;
  clientName: string;
  lawId: string;
  lawCode: string;
  ruleName: string;
  dueDate: string; // ISO
  periodLabel: string; // "Q1 2026", "Mar 2026"
  handler?: Handler;
  jurisdiction: Law['jurisdiction'];
  status: 'overdue' | 'due-today' | 'due-this-week' | 'upcoming' | 'filed' | 'draft';
}
