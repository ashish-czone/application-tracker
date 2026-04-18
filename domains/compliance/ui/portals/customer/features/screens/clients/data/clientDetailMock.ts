import type { Handler } from '../../../../../../shared/types';
import { MOCK_HANDLERS } from '../../../console-preview/mockData';
import type { ClientRow, ClientRiskLevel } from './clientsMock';

// ─── Registered law for the client detail Laws tab ─────────────────

export interface ClientLaw {
  id: string;
  code: string;
  name: string;
  jurisdiction: 'central' | 'state' | 'municipal' | 'international';
  cadence: string;
  nextDue: string; // ISO date
  openFilings: number;
  overdueFilings: number;
  onTimePct: number;
  handler: Handler;
  registeredAt: string; // ISO date
}

// ─── Filing row for the client detail Filings tab ──────────────────

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

// ─── Activity event for the overview ───────────────────────────────

export interface ClientActivity {
  id: string;
  type: 'filing-submitted' | 'handler-changed' | 'law-added' | 'status-change' | 'note-added';
  actor: Handler;
  timestamp: string;
  detail: string;
}

// ─── Contact info ──────────────────────────────────────────────────

export interface ClientContact {
  name: string;
  email: string;
  phone: string;
  designation: string;
}

// ─── Full client detail ────────────────────────────────────────────

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

// ─── Mock data for client c1 (Aarav Industries) ────────────────────

export const MOCK_CLIENT_DETAIL: ClientDetail = {
  id: 'c1',
  name: 'Aarav Industries',
  legalName: 'Aarav Industries Pvt. Ltd.',
  taxIdentifier: '27AABCA1234H1Z5',
  initials: 'AI',
  color: 'hsl(218 56% 24%)',
  status: 'active',
  risk: 'at-risk' as ClientRiskLevel,
  registeredLaws: 5,
  openFilings: 8,
  overdueFilings: 2,
  onTimePct: 84,
  primaryHandler: MOCK_HANDLERS[0],
  primaryContactEmail: 'finance@aaravindustries.in',
  onboardedDate: '2024-03-15',
  lastFilingDate: '2026-04-10',
  industry: 'Manufacturing',
  address: 'Plot 42, MIDC Industrial Area, Andheri East, Mumbai — 400093',
  totalFilings: 156,
  filedThisMonth: 3,
  filedOnTime: 131,
  primaryContact: {
    name: 'Rajeev Kumar',
    email: 'finance@aaravindustries.in',
    phone: '+91 98765 43210',
    designation: 'CFO',
  },
  secondaryContact: {
    name: 'Meera Desai',
    email: 'meera.d@aaravindustries.in',
    phone: '+91 98765 43211',
    designation: 'Accounts Manager',
  },
  registeredLawDetails: [
    {
      id: 'cl1',
      code: 'GST',
      name: 'Goods & Services Tax',
      jurisdiction: 'central',
      cadence: 'Monthly',
      nextDue: '2026-04-20',
      openFilings: 3,
      overdueFilings: 1,
      onTimePct: 82,
      handler: MOCK_HANDLERS[0],
      registeredAt: '2024-03-15',
    },
    {
      id: 'cl2',
      code: 'ITR',
      name: 'Income Tax Return',
      jurisdiction: 'central',
      cadence: 'Yearly',
      nextDue: '2026-09-30',
      openFilings: 1,
      overdueFilings: 0,
      onTimePct: 100,
      handler: MOCK_HANDLERS[3],
      registeredAt: '2024-03-15',
    },
    {
      id: 'cl3',
      code: 'TDS',
      name: 'Tax Deducted at Source',
      jurisdiction: 'central',
      cadence: 'Quarterly',
      nextDue: '2026-04-30',
      openFilings: 2,
      overdueFilings: 1,
      onTimePct: 79,
      handler: MOCK_HANDLERS[1],
      registeredAt: '2024-03-15',
    },
    {
      id: 'cl4',
      code: 'ROC',
      name: 'Registrar of Companies',
      jurisdiction: 'central',
      cadence: 'Yearly',
      nextDue: '2026-10-30',
      openFilings: 1,
      overdueFilings: 0,
      onTimePct: 88,
      handler: MOCK_HANDLERS[2],
      registeredAt: '2024-06-01',
    },
    {
      id: 'cl5',
      code: 'PT',
      name: 'Professional Tax',
      jurisdiction: 'state',
      cadence: 'Monthly',
      nextDue: '2026-04-15',
      openFilings: 1,
      overdueFilings: 0,
      onTimePct: 90,
      handler: MOCK_HANDLERS[1],
      registeredAt: '2024-09-10',
    },
  ],
  recentFilings: [
    {
      id: 'cf1',
      lawCode: 'GSTR-3B',
      ruleName: 'GSTR-3B Monthly Return',
      period: 'Mar 2026',
      dueDate: '2026-04-12',
      status: 'overdue',
      priority: 'critical',
      handler: MOCK_HANDLERS[0],
      jurisdiction: 'central',
    },
    {
      id: 'cf2',
      lawCode: 'TDS-26Q',
      ruleName: 'TDS Return 26Q',
      period: 'Q4 FY26',
      dueDate: '2026-04-17',
      status: 'due-this-week',
      priority: 'high',
      handler: MOCK_HANDLERS[1],
      jurisdiction: 'central',
    },
    {
      id: 'cf3',
      lawCode: 'GSTR-1',
      ruleName: 'GSTR-1 Outward Supplies',
      period: 'Mar 2026',
      dueDate: '2026-04-15',
      status: 'due-today',
      priority: 'high',
      handler: MOCK_HANDLERS[0],
      jurisdiction: 'central',
    },
    {
      id: 'cf4',
      lawCode: 'PT-STATE',
      ruleName: 'Professional Tax Return',
      period: 'Mar 2026',
      dueDate: '2026-04-24',
      status: 'upcoming',
      priority: 'normal',
      handler: MOCK_HANDLERS[1],
      jurisdiction: 'state',
    },
    {
      id: 'cf5',
      lawCode: 'TDS-24Q',
      ruleName: 'TDS Return 24Q',
      period: 'Q4 FY26',
      dueDate: '2026-04-30',
      status: 'upcoming',
      priority: 'normal',
      handler: MOCK_HANDLERS[1],
      jurisdiction: 'central',
    },
    {
      id: 'cf6',
      lawCode: 'ROC-AOC4',
      ruleName: 'AOC-4 Annual Filing',
      period: 'FY 2025-26',
      dueDate: '2026-10-30',
      status: 'upcoming',
      priority: 'normal',
      handler: MOCK_HANDLERS[2],
      jurisdiction: 'central',
    },
    {
      id: 'cf7',
      lawCode: 'GSTR-3B',
      ruleName: 'GSTR-3B Monthly Return',
      period: 'Feb 2026',
      dueDate: '2026-03-20',
      filedDate: '2026-03-19',
      status: 'filed',
      priority: 'normal',
      handler: MOCK_HANDLERS[0],
      jurisdiction: 'central',
    },
    {
      id: 'cf8',
      lawCode: 'GSTR-1',
      ruleName: 'GSTR-1 Outward Supplies',
      period: 'Feb 2026',
      dueDate: '2026-03-11',
      filedDate: '2026-03-10',
      status: 'filed',
      priority: 'normal',
      handler: MOCK_HANDLERS[0],
      jurisdiction: 'central',
    },
  ],
  recentActivity: [
    {
      id: 'ca1',
      type: 'filing-submitted',
      actor: MOCK_HANDLERS[0],
      timestamp: '2026-04-10T14:30:00Z',
      detail: 'Filed GSTR-3B for Feb 2026',
    },
    {
      id: 'ca2',
      type: 'handler-changed',
      actor: MOCK_HANDLERS[3],
      timestamp: '2026-04-08T09:15:00Z',
      detail: 'Reassigned TDS from Arjun to Priya',
    },
    {
      id: 'ca3',
      type: 'note-added',
      actor: MOCK_HANDLERS[2],
      timestamp: '2026-04-05T16:45:00Z',
      detail: 'Requested updated financials for ROC filing',
    },
    {
      id: 'ca4',
      type: 'status-change',
      actor: MOCK_HANDLERS[0],
      timestamp: '2026-04-01T10:00:00Z',
      detail: 'Client risk changed from healthy to at-risk',
    },
    {
      id: 'ca5',
      type: 'law-added',
      actor: MOCK_HANDLERS[3],
      timestamp: '2026-03-15T11:30:00Z',
      detail: 'Registered under Professional Tax (PT)',
    },
  ],
};
