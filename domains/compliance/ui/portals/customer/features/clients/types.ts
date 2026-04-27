import type { Handler } from '../../../../shared/types';

// Status + risk taxonomy — the workflow vocabulary the clients screen renders.
export type ClientStatus = 'active' | 'onboarding' | 'dormant';
export type ClientRiskLevel = 'healthy' | 'at-risk' | 'critical';

// Row shape for the clients list/grid view. Composes the API record with
// derived presentation fields (initials, color, computed risk band, on-time
// rate, primary handler resolved from FK). Built by `mapClientRecordToRow`.
export interface ClientRow {
  id: string;
  name: string;
  legalName: string;
  taxIdentifier: string;
  initials: string;
  color: string;
  status: ClientStatus;
  risk: ClientRiskLevel;
  registeredLaws: number;
  openFilings: number;
  overdueFilings: number;
  onTimePct: number;
  primaryHandler: Handler;
  primaryContactEmail: string;
  onboardedDate: string;
  lastFilingDate: string;
}

// Registered law for the client detail Laws tab.
export interface ClientLaw {
  id: string;
  lawId: string;
  clientId: string;
  code: string;
  name: string;
  jurisdiction: 'central' | 'state' | 'municipal' | 'international';
  cadence: string;
  nextDue: string;
  openFilings: number;
  overdueFilings: number;
  onTimePct: number;
  handler: Handler;
  registeredAt: string;
  deactivatedAt?: string | null;
}

// Filing row for the client detail Filings tab.
export type ClientFilingStatus = 'overdue' | 'due-today' | 'due-this-week' | 'upcoming' | 'filed';

export interface ClientFiling {
  id: string;
  lawCode: string;
  ruleName: string;
  period: string;
  dueDate: string;
  filedDate?: string;
  status: ClientFilingStatus;
  priority: 'critical' | 'high' | 'normal' | 'low';
  handler: Handler;
  jurisdiction: 'central' | 'state';
}

// Activity event for the client detail overview.
export interface ClientActivity {
  id: string;
  type: 'filing-submitted' | 'handler-changed' | 'law-added' | 'status-change' | 'note-added';
  actor: Handler;
  timestamp: string;
  detail: string;
}

// Contact info on a client.
export interface ClientContact {
  name: string;
  email: string;
  phone: string;
  designation: string;
}

// Full client detail — extends the row shape with detail-page fields.
export interface ClientDetail extends ClientRow {
  primaryContact: ClientContact;
  secondaryContact?: ClientContact;
  address: string;
  industry: string;
  registeredLawDetails: ClientLaw[];
  recentFilings: ClientFiling[];
  recentActivity: ClientActivity[];
  totalFilings: number;
  filedThisMonth: number;
  filedOnTime: number;
}
