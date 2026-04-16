import type { Filing, Handler } from '../../../../../shared/types';
import { MOCK_HANDLERS } from '../../console-preview/mockData';

// ─── Extended filing row for the Filings list screen ────────────────

export interface FilingNote {
  id: string;
  author: Handler;
  text: string;
  createdAt: string;
}

export interface FilingAttachment {
  id: string;
  name: string;
  size: string;
  uploadedBy: Handler;
  uploadedAt: string;
}

export interface FilingActivity {
  id: string;
  type: 'status-change' | 'note-added' | 'attachment-added' | 'assigned' | 'created';
  actor: Handler;
  timestamp: string;
  detail: string;
}

export interface FilingRow extends Filing {
  priority: 'critical' | 'high' | 'normal' | 'low';
  filedDate?: string;
  notes: FilingNote[];
  attachments: FilingAttachment[];
  activity: FilingActivity[];
}

// ─── Constants ──────────────────────────────────────────────────────

export const FILINGS_TODAY = new Date(2026, 3, 15); // 15 April 2026

function daysFromToday(offset: number): string {
  const d = new Date(FILINGS_TODAY);
  d.setDate(d.getDate() + offset);
  return d.toISOString();
}

function dateStr(offset: number): string {
  const d = new Date(FILINGS_TODAY);
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

// ─── Helpers for activity / notes ───────────────────────────────────

function makeActivity(filingId: string, handler: Handler, status: Filing['status']): FilingActivity[] {
  return [
    {
      id: `${filingId}-a1`,
      type: 'created',
      actor: MOCK_HANDLERS[3],
      timestamp: daysFromToday(-30),
      detail: 'Filing created for this period',
    },
    {
      id: `${filingId}-a2`,
      type: 'assigned',
      actor: MOCK_HANDLERS[3],
      timestamp: daysFromToday(-28),
      detail: `Assigned to ${handler.name}`,
    },
    ...(status === 'filed'
      ? [
          {
            id: `${filingId}-a3`,
            type: 'status-change' as const,
            actor: handler,
            timestamp: daysFromToday(-2),
            detail: 'Status changed to Filed',
          },
        ]
      : []),
  ];
}

// ─── Mock data ──────────────────────────────────────────────────────

export const MOCK_FILING_ROWS: FilingRow[] = [
  {
    id: 'f1',
    clientId: 'c1',
    clientName: 'Aarav Industries',
    lawId: 'l1',
    lawCode: 'GSTR-3B',
    ruleName: 'GSTR-3B Monthly Return',
    dueDate: daysFromToday(-3),
    periodLabel: 'Mar 2026',
    handler: MOCK_HANDLERS[0],
    jurisdiction: 'central',
    status: 'overdue',
    priority: 'critical',
    notes: [
      { id: 'n1', author: MOCK_HANDLERS[0], text: 'Client hasn\'t sent March invoices yet. Following up.', createdAt: daysFromToday(-1) },
    ],
    attachments: [],
    activity: makeActivity('f1', MOCK_HANDLERS[0], 'overdue'),
  },
  {
    id: 'f2',
    clientId: 'c2',
    clientName: 'Bluewave Exports',
    lawId: 'l1',
    lawCode: 'GSTR-1',
    ruleName: 'GSTR-1 Outward Supplies',
    dueDate: daysFromToday(0),
    periodLabel: 'Mar 2026',
    handler: MOCK_HANDLERS[0],
    jurisdiction: 'central',
    status: 'due-today',
    priority: 'high',
    notes: [],
    attachments: [
      { id: 'a1', name: 'march-invoices.xlsx', size: '245 KB', uploadedBy: MOCK_HANDLERS[0], uploadedAt: daysFromToday(-1) },
    ],
    activity: makeActivity('f2', MOCK_HANDLERS[0], 'due-today'),
  },
  {
    id: 'f3',
    clientId: 'c3',
    clientName: 'Cedar Retail',
    lawId: 'l3',
    lawCode: 'TDS-26Q',
    ruleName: 'TDS Return 26Q',
    dueDate: daysFromToday(2),
    periodLabel: 'Q4 FY26',
    handler: MOCK_HANDLERS[1],
    jurisdiction: 'central',
    status: 'due-this-week',
    priority: 'high',
    notes: [],
    attachments: [],
    activity: makeActivity('f3', MOCK_HANDLERS[1], 'due-this-week'),
  },
  {
    id: 'f4',
    clientId: 'c4',
    clientName: 'Drift Media',
    lawId: 'l1',
    lawCode: 'GSTR-3B',
    ruleName: 'GSTR-3B Monthly Return',
    dueDate: daysFromToday(-10),
    periodLabel: 'Mar 2026',
    handler: MOCK_HANDLERS[0],
    jurisdiction: 'central',
    status: 'filed',
    priority: 'normal',
    filedDate: dateStr(-8),
    notes: [],
    attachments: [
      { id: 'a2', name: 'gstr3b-mar26.pdf', size: '128 KB', uploadedBy: MOCK_HANDLERS[0], uploadedAt: daysFromToday(-8) },
    ],
    activity: makeActivity('f4', MOCK_HANDLERS[0], 'filed'),
  },
  {
    id: 'f5',
    clientId: 'c5',
    clientName: 'Evergreen Labs',
    lawId: 'l4',
    lawCode: 'ROC-AOC4',
    ruleName: 'AOC-4 Annual Filing',
    dueDate: daysFromToday(6),
    periodLabel: 'FY 2025-26',
    handler: MOCK_HANDLERS[2],
    jurisdiction: 'central',
    status: 'upcoming',
    priority: 'normal',
    notes: [],
    attachments: [],
    activity: makeActivity('f5', MOCK_HANDLERS[2], 'upcoming'),
  },
  {
    id: 'f6',
    clientId: 'c6',
    clientName: 'Fable Studios',
    lawId: 'l2',
    lawCode: 'ITR-6',
    ruleName: 'Income Tax Return — ITR-6',
    dueDate: daysFromToday(14),
    periodLabel: 'AY 2026-27',
    handler: MOCK_HANDLERS[3],
    jurisdiction: 'central',
    status: 'upcoming',
    priority: 'normal',
    notes: [],
    attachments: [],
    activity: makeActivity('f6', MOCK_HANDLERS[3], 'upcoming'),
  },
  {
    id: 'f7',
    clientId: 'c2',
    clientName: 'Bluewave Exports',
    lawId: 'l5',
    lawCode: 'PT-STATE',
    ruleName: 'Professional Tax Return',
    dueDate: daysFromToday(-8),
    periodLabel: 'Mar 2026',
    handler: MOCK_HANDLERS[1],
    jurisdiction: 'state',
    status: 'filed',
    priority: 'normal',
    filedDate: dateStr(-6),
    notes: [],
    attachments: [],
    activity: makeActivity('f7', MOCK_HANDLERS[1], 'filed'),
  },
  {
    id: 'f8',
    clientId: 'c1',
    clientName: 'Aarav Industries',
    lawId: 'l3',
    lawCode: 'TDS-24Q',
    ruleName: 'TDS Return 24Q',
    dueDate: daysFromToday(4),
    periodLabel: 'Q4 FY26',
    handler: MOCK_HANDLERS[1],
    jurisdiction: 'central',
    status: 'due-this-week',
    priority: 'normal',
    notes: [
      { id: 'n2', author: MOCK_HANDLERS[1], text: 'Salary data received. Processing.', createdAt: daysFromToday(0) },
    ],
    attachments: [
      { id: 'a3', name: 'salary-q4.xlsx', size: '312 KB', uploadedBy: MOCK_HANDLERS[1], uploadedAt: daysFromToday(0) },
    ],
    activity: makeActivity('f8', MOCK_HANDLERS[1], 'due-this-week'),
  },
  {
    id: 'f9',
    clientId: 'c3',
    clientName: 'Cedar Retail',
    lawId: 'l1',
    lawCode: 'GSTR-1',
    ruleName: 'GSTR-1 Outward Supplies',
    dueDate: daysFromToday(0),
    periodLabel: 'Mar 2026',
    handler: MOCK_HANDLERS[0],
    jurisdiction: 'central',
    status: 'due-today',
    priority: 'high',
    notes: [],
    attachments: [],
    activity: makeActivity('f9', MOCK_HANDLERS[0], 'due-today'),
  },
  {
    id: 'f10',
    clientId: 'c4',
    clientName: 'Drift Media',
    lawId: 'l2',
    lawCode: 'ITR-6',
    ruleName: 'Income Tax Return — ITR-6',
    dueDate: daysFromToday(21),
    periodLabel: 'AY 2026-27',
    handler: MOCK_HANDLERS[3],
    jurisdiction: 'central',
    status: 'upcoming',
    priority: 'low',
    notes: [],
    attachments: [],
    activity: makeActivity('f10', MOCK_HANDLERS[3], 'upcoming'),
  },
  {
    id: 'f11',
    clientId: 'c5',
    clientName: 'Evergreen Labs',
    lawId: 'l1',
    lawCode: 'GSTR-3B',
    ruleName: 'GSTR-3B Monthly Return',
    dueDate: daysFromToday(1),
    periodLabel: 'Mar 2026',
    handler: MOCK_HANDLERS[0],
    jurisdiction: 'central',
    status: 'due-this-week',
    priority: 'high',
    notes: [],
    attachments: [],
    activity: makeActivity('f11', MOCK_HANDLERS[0], 'due-this-week'),
  },
  {
    id: 'f12',
    clientId: 'c6',
    clientName: 'Fable Studios',
    lawId: 'l4',
    lawCode: 'ROC-MGT7',
    ruleName: 'MGT-7 Annual Return',
    dueDate: daysFromToday(-1),
    periodLabel: 'FY 2025-26',
    handler: MOCK_HANDLERS[2],
    jurisdiction: 'central',
    status: 'overdue',
    priority: 'critical',
    notes: [
      { id: 'n3', author: MOCK_HANDLERS[2], text: 'Board minutes not received from client. Escalated.', createdAt: daysFromToday(0) },
    ],
    attachments: [],
    activity: makeActivity('f12', MOCK_HANDLERS[2], 'overdue'),
  },
  {
    id: 'f13',
    clientId: 'c1',
    clientName: 'Aarav Industries',
    lawId: 'l5',
    lawCode: 'PT-STATE',
    ruleName: 'Professional Tax Return',
    dueDate: daysFromToday(9),
    periodLabel: 'Mar 2026',
    handler: MOCK_HANDLERS[1],
    jurisdiction: 'state',
    status: 'upcoming',
    priority: 'normal',
    notes: [],
    attachments: [],
    activity: makeActivity('f13', MOCK_HANDLERS[1], 'upcoming'),
  },
  {
    id: 'f14',
    clientId: 'c2',
    clientName: 'Bluewave Exports',
    lawId: 'l2',
    lawCode: 'ITR-6',
    ruleName: 'Income Tax Return — ITR-6',
    dueDate: daysFromToday(18),
    periodLabel: 'AY 2026-27',
    handler: MOCK_HANDLERS[3],
    jurisdiction: 'central',
    status: 'upcoming',
    priority: 'normal',
    notes: [],
    attachments: [],
    activity: makeActivity('f14', MOCK_HANDLERS[3], 'upcoming'),
  },
  {
    id: 'f15',
    clientId: 'c3',
    clientName: 'Cedar Retail',
    lawId: 'l4',
    lawCode: 'ROC-AOC4',
    ruleName: 'AOC-4 Annual Filing',
    dueDate: daysFromToday(12),
    periodLabel: 'FY 2025-26',
    handler: MOCK_HANDLERS[2],
    jurisdiction: 'central',
    status: 'upcoming',
    priority: 'normal',
    notes: [],
    attachments: [],
    activity: makeActivity('f15', MOCK_HANDLERS[2], 'upcoming'),
  },
  {
    id: 'f16',
    clientId: 'c5',
    clientName: 'Evergreen Labs',
    lawId: 'l3',
    lawCode: 'TDS-26Q',
    ruleName: 'TDS Return 26Q',
    dueDate: daysFromToday(-5),
    periodLabel: 'Q4 FY26',
    handler: MOCK_HANDLERS[1],
    jurisdiction: 'central',
    status: 'overdue',
    priority: 'high',
    notes: [
      { id: 'n4', author: MOCK_HANDLERS[1], text: 'Pending vendor data for deductee-wise breakdown.', createdAt: daysFromToday(-2) },
    ],
    attachments: [],
    activity: makeActivity('f16', MOCK_HANDLERS[1], 'overdue'),
  },
  {
    id: 'f17',
    clientId: 'c1',
    clientName: 'Aarav Industries',
    lawId: 'l1',
    lawCode: 'GSTR-1',
    ruleName: 'GSTR-1 Outward Supplies',
    dueDate: daysFromToday(-12),
    periodLabel: 'Mar 2026',
    handler: MOCK_HANDLERS[0],
    jurisdiction: 'central',
    status: 'filed',
    priority: 'normal',
    filedDate: dateStr(-10),
    notes: [],
    attachments: [
      { id: 'a4', name: 'gstr1-mar26-aarav.pdf', size: '198 KB', uploadedBy: MOCK_HANDLERS[0], uploadedAt: daysFromToday(-10) },
    ],
    activity: makeActivity('f17', MOCK_HANDLERS[0], 'filed'),
  },
  {
    id: 'f18',
    clientId: 'c4',
    clientName: 'Drift Media',
    lawId: 'l3',
    lawCode: 'TDS-24Q',
    ruleName: 'TDS Return 24Q',
    dueDate: daysFromToday(3),
    periodLabel: 'Q4 FY26',
    handler: MOCK_HANDLERS[1],
    jurisdiction: 'central',
    status: 'due-this-week',
    priority: 'normal',
    notes: [],
    attachments: [],
    activity: makeActivity('f18', MOCK_HANDLERS[1], 'due-this-week'),
  },
  {
    id: 'f19',
    clientId: 'c6',
    clientName: 'Fable Studios',
    lawId: 'l1',
    lawCode: 'GSTR-3B',
    ruleName: 'GSTR-3B Monthly Return',
    dueDate: daysFromToday(-7),
    periodLabel: 'Mar 2026',
    handler: MOCK_HANDLERS[0],
    jurisdiction: 'central',
    status: 'filed',
    priority: 'normal',
    filedDate: dateStr(-5),
    notes: [],
    attachments: [],
    activity: makeActivity('f19', MOCK_HANDLERS[0], 'filed'),
  },
  {
    id: 'f20',
    clientId: 'c3',
    clientName: 'Cedar Retail',
    lawId: 'l5',
    lawCode: 'PT-STATE',
    ruleName: 'Professional Tax Return',
    dueDate: daysFromToday(5),
    periodLabel: 'Mar 2026',
    handler: MOCK_HANDLERS[1],
    jurisdiction: 'state',
    status: 'due-this-week',
    priority: 'normal',
    notes: [],
    attachments: [],
    activity: makeActivity('f20', MOCK_HANDLERS[1], 'due-this-week'),
  },
  {
    id: 'f21',
    clientId: 'c2',
    clientName: 'Bluewave Exports',
    lawId: 'l1',
    lawCode: 'GSTR-3B',
    ruleName: 'GSTR-3B Monthly Return',
    dueDate: daysFromToday(-4),
    periodLabel: 'Mar 2026',
    handler: MOCK_HANDLERS[0],
    jurisdiction: 'central',
    status: 'overdue',
    priority: 'high',
    notes: [],
    attachments: [],
    activity: makeActivity('f21', MOCK_HANDLERS[0], 'overdue'),
  },
  {
    id: 'f22',
    clientId: 'c5',
    clientName: 'Evergreen Labs',
    lawId: 'l2',
    lawCode: 'ITR-6',
    ruleName: 'Income Tax Return — ITR-6',
    dueDate: daysFromToday(25),
    periodLabel: 'AY 2026-27',
    handler: MOCK_HANDLERS[3],
    jurisdiction: 'central',
    status: 'upcoming',
    priority: 'low',
    notes: [],
    attachments: [],
    activity: makeActivity('f22', MOCK_HANDLERS[3], 'upcoming'),
  },
  {
    id: 'f23',
    clientId: 'c4',
    clientName: 'Drift Media',
    lawId: 'l5',
    lawCode: 'PT-STATE',
    ruleName: 'Professional Tax Return',
    dueDate: daysFromToday(-15),
    periodLabel: 'Feb 2026',
    handler: MOCK_HANDLERS[1],
    jurisdiction: 'state',
    status: 'filed',
    priority: 'normal',
    filedDate: dateStr(-13),
    notes: [],
    attachments: [],
    activity: makeActivity('f23', MOCK_HANDLERS[1], 'filed'),
  },
  {
    id: 'f24',
    clientId: 'c1',
    clientName: 'Aarav Industries',
    lawId: 'l4',
    lawCode: 'ROC-MGT7',
    ruleName: 'MGT-7 Annual Return',
    dueDate: daysFromToday(10),
    periodLabel: 'FY 2025-26',
    handler: MOCK_HANDLERS[2],
    jurisdiction: 'central',
    status: 'upcoming',
    priority: 'normal',
    notes: [],
    attachments: [],
    activity: makeActivity('f24', MOCK_HANDLERS[2], 'upcoming'),
  },
];

// ─── Aggregate counts ───────────────────────────────────────────────

export const FILING_STATUS_COUNTS = {
  overdue: MOCK_FILING_ROWS.filter((f) => f.status === 'overdue').length,
  'due-today': MOCK_FILING_ROWS.filter((f) => f.status === 'due-today').length,
  'due-this-week': MOCK_FILING_ROWS.filter((f) => f.status === 'due-this-week').length,
  upcoming: MOCK_FILING_ROWS.filter((f) => f.status === 'upcoming').length,
  filed: MOCK_FILING_ROWS.filter((f) => f.status === 'filed').length,
};

export const HANDLER_OPTIONS = MOCK_HANDLERS.map((h) => ({
  value: h.id,
  label: h.name,
}));

export const CLIENT_OPTIONS = [
  { value: 'c1', label: 'Aarav Industries' },
  { value: 'c2', label: 'Bluewave Exports' },
  { value: 'c3', label: 'Cedar Retail' },
  { value: 'c4', label: 'Drift Media' },
  { value: 'c5', label: 'Evergreen Labs' },
  { value: 'c6', label: 'Fable Studios' },
];

export const LAW_OPTIONS = [
  { value: 'l1', label: 'GST' },
  { value: 'l2', label: 'Income Tax' },
  { value: 'l3', label: 'TDS / TCS' },
  { value: 'l4', label: 'ROC' },
  { value: 'l5', label: 'Professional Tax' },
];
