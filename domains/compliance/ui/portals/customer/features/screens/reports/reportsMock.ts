// ─── Types ──────────────────────────────────────────────────────────

export type ReportTab = 'compliance' | 'overdue' | 'workload';

// ─── Compliance Summary ─────────────────────────────────────────────

export interface ComplianceRow {
  id: string;
  clientName: string;
  initials: string;
  color: string;
  totalFilings: number;
  onTime: number;
  late: number;
  overdue: number;
  onTimeRate: number; // pct
}

export const COMPLIANCE_MONTHS = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'];

export const COMPLIANCE_TREND: { month: string; onTime: number; late: number; overdue: number }[] = [
  { month: 'Nov', onTime: 42, late: 5, overdue: 3 },
  { month: 'Dec', onTime: 38, late: 7, overdue: 5 },
  { month: 'Jan', onTime: 45, late: 4, overdue: 2 },
  { month: 'Feb', onTime: 40, late: 6, overdue: 4 },
  { month: 'Mar', onTime: 48, late: 3, overdue: 2 },
  { month: 'Apr', onTime: 35, late: 5, overdue: 3 },
];

export const COMPLIANCE_ROWS: ComplianceRow[] = [
  { id: 'c1', clientName: 'Reliance Industries Ltd', initials: 'RI', color: '#1D3461', totalFilings: 18, onTime: 15, late: 2, overdue: 1, onTimeRate: 83 },
  { id: 'c2', clientName: 'Tata Consultancy Services', initials: 'TC', color: '#3A6F4A', totalFilings: 16, onTime: 15, late: 1, overdue: 0, onTimeRate: 94 },
  { id: 'c3', clientName: 'Infosys Ltd', initials: 'IL', color: '#5B4A8A', totalFilings: 14, onTime: 12, late: 1, overdue: 1, onTimeRate: 86 },
  { id: 'c4', clientName: 'Bajaj Finance Ltd', initials: 'BF', color: '#8B5E3C', totalFilings: 12, onTime: 10, late: 2, overdue: 0, onTimeRate: 83 },
  { id: 'c5', clientName: 'HDFC Bank Ltd', initials: 'HB', color: '#1D3461', totalFilings: 15, onTime: 14, late: 0, overdue: 1, onTimeRate: 93 },
  { id: 'c6', clientName: 'Wipro Ltd', initials: 'WL', color: '#C6541D', totalFilings: 10, onTime: 8, late: 1, overdue: 1, onTimeRate: 80 },
  { id: 'c7', clientName: 'Mahindra & Mahindra', initials: 'MM', color: '#3A6F4A', totalFilings: 13, onTime: 12, late: 1, overdue: 0, onTimeRate: 92 },
  { id: 'c8', clientName: 'Larsen & Toubro', initials: 'LT', color: '#5B4A8A', totalFilings: 11, onTime: 9, late: 1, overdue: 1, onTimeRate: 82 },
  { id: 'c9', clientName: 'Sun Pharmaceuticals', initials: 'SP', color: '#8B5E3C', totalFilings: 9, onTime: 9, late: 0, overdue: 0, onTimeRate: 100 },
  { id: 'c10', clientName: 'Adani Enterprises', initials: 'AE', color: '#C6541D', totalFilings: 8, onTime: 6, late: 1, overdue: 1, onTimeRate: 75 },
  { id: 'c11', clientName: 'Axis Bank Ltd', initials: 'AB', color: '#1D3461', totalFilings: 7, onTime: 7, late: 0, overdue: 0, onTimeRate: 100 },
];

// ─── Overdue Aging ──────────────────────────────────────────────────

export interface OverdueRow {
  id: string;
  filingName: string;
  lawCode: string;
  clientName: string;
  clientInitials: string;
  clientColor: string;
  dueDate: string; // ISO
  daysOverdue: number;
  handler: string;
  handlerInitials: string;
  priority: 'critical' | 'high' | 'medium';
}

export interface AgingBucket {
  label: string;
  range: string;
  count: number;
  tone: 'due-soon' | 'signal' | 'signal';
}

export const AGING_BUCKETS: AgingBucket[] = [
  { label: '1–7 days', range: '1-7', count: 5, tone: 'due-soon' },
  { label: '8–15 days', range: '8-15', count: 3, tone: 'signal' },
  { label: '16–30 days', range: '16-30', count: 2, tone: 'signal' },
  { label: '30+ days', range: '30+', count: 1, tone: 'signal' },
];

export const OVERDUE_ROWS: OverdueRow[] = [
  { id: 'o1', filingName: 'GSTR-1 Monthly Return', lawCode: 'GST-001', clientName: 'Reliance Industries', clientInitials: 'RI', clientColor: '#1D3461', dueDate: '2026-04-15T00:00:00Z', daysOverdue: 2, handler: 'Ravi Kumar', handlerInitials: 'RK', priority: 'high' },
  { id: 'o2', filingName: 'TDS Return Q4', lawCode: 'IT-024', clientName: 'Wipro Ltd', clientInitials: 'WL', clientColor: '#C6541D', dueDate: '2026-04-12T00:00:00Z', daysOverdue: 5, handler: 'Sneha Patel', handlerInitials: 'SP', priority: 'high' },
  { id: 'o3', filingName: 'Annual ROC Filing', lawCode: 'ROC-003', clientName: 'Infosys Ltd', clientInitials: 'IL', clientColor: '#5B4A8A', dueDate: '2026-04-10T00:00:00Z', daysOverdue: 7, handler: 'Rahul Gupta', handlerInitials: 'RG', priority: 'high' },
  { id: 'o4', filingName: 'GSTR-3B Return', lawCode: 'GST-003', clientName: 'Adani Enterprises', clientInitials: 'AE', clientColor: '#C6541D', dueDate: '2026-04-05T00:00:00Z', daysOverdue: 12, handler: 'Ravi Kumar', handlerInitials: 'RK', priority: 'critical' },
  { id: 'o5', filingName: 'Advance Tax Instalment', lawCode: 'IT-011', clientName: 'Larsen & Toubro', clientInitials: 'LT', clientColor: '#5B4A8A', dueDate: '2026-04-03T00:00:00Z', daysOverdue: 14, handler: 'Meera Reddy', handlerInitials: 'MR', priority: 'critical' },
  { id: 'o6', filingName: 'PF Monthly Return', lawCode: 'LAB-002', clientName: 'Reliance Industries', clientInitials: 'RI', clientColor: '#1D3461', dueDate: '2026-04-01T00:00:00Z', daysOverdue: 16, handler: 'Sanjay Mehta', handlerInitials: 'SM', priority: 'critical' },
  { id: 'o7', filingName: 'ESI Half-Yearly', lawCode: 'LAB-005', clientName: 'Bajaj Finance', clientInitials: 'BF', clientColor: '#8B5E3C', dueDate: '2026-03-31T00:00:00Z', daysOverdue: 17, handler: 'Sanjay Mehta', handlerInitials: 'SM', priority: 'critical' },
  { id: 'o8', filingName: 'Income Tax Audit Report', lawCode: 'IT-008', clientName: 'HDFC Bank', clientInitials: 'HB', clientColor: '#1D3461', dueDate: '2026-03-28T00:00:00Z', daysOverdue: 20, handler: 'Meera Reddy', handlerInitials: 'MR', priority: 'critical' },
  { id: 'o9', filingName: 'GSTR-9 Annual Return', lawCode: 'GST-009', clientName: 'Wipro Ltd', clientInitials: 'WL', clientColor: '#C6541D', dueDate: '2026-03-20T00:00:00Z', daysOverdue: 28, handler: 'Ravi Kumar', handlerInitials: 'RK', priority: 'critical' },
  { id: 'o10', filingName: 'Company Annual Return', lawCode: 'ROC-001', clientName: 'Adani Enterprises', clientInitials: 'AE', clientColor: '#C6541D', dueDate: '2026-03-10T00:00:00Z', daysOverdue: 38, handler: 'Rahul Gupta', handlerInitials: 'RG', priority: 'critical' },
  { id: 'o11', filingName: 'GST Audit Report', lawCode: 'GST-012', clientName: 'Larsen & Toubro', clientInitials: 'LT', clientColor: '#5B4A8A', dueDate: '2026-04-14T00:00:00Z', daysOverdue: 3, handler: 'Ravi Kumar', handlerInitials: 'RK', priority: 'medium' },
];

// ─── Team Workload ──────────────────────────────────────────────────

export interface WorkloadRow {
  id: string;
  name: string;
  initials: string;
  color: string;
  role: string;
  totalAssigned: number;
  completed: number;
  inProgress: number;
  overdue: number;
  onTimeRate: number; // pct
  avgDaysToComplete: number;
}

export const WORKLOAD_ROWS: WorkloadRow[] = [
  { id: 'w1', name: 'Ravi Kumar', initials: 'RK', color: '#3A6F4A', role: 'Manager', totalAssigned: 28, completed: 20, inProgress: 5, overdue: 3, onTimeRate: 85, avgDaysToComplete: 4.2 },
  { id: 'w2', name: 'Meera Reddy', initials: 'MR', color: '#8B5E3C', role: 'Manager', totalAssigned: 24, completed: 18, inProgress: 4, overdue: 2, onTimeRate: 89, avgDaysToComplete: 3.8 },
  { id: 'w3', name: 'Sanjay Mehta', initials: 'SM', color: '#5B4A8A', role: 'Manager', totalAssigned: 22, completed: 17, inProgress: 3, overdue: 2, onTimeRate: 88, avgDaysToComplete: 3.5 },
  { id: 'w4', name: 'Rahul Gupta', initials: 'RG', color: '#1D3461', role: 'Associate', totalAssigned: 18, completed: 13, inProgress: 3, overdue: 2, onTimeRate: 81, avgDaysToComplete: 5.1 },
  { id: 'w5', name: 'Sneha Patel', initials: 'SP', color: '#8B5E3C', role: 'Associate', totalAssigned: 16, completed: 12, inProgress: 3, overdue: 1, onTimeRate: 92, avgDaysToComplete: 3.2 },
  { id: 'w6', name: 'Neha Kapoor', initials: 'NK', color: '#5B4A8A', role: 'Associate', totalAssigned: 14, completed: 10, inProgress: 3, overdue: 1, onTimeRate: 90, avgDaysToComplete: 4.0 },
  { id: 'w7', name: 'Anita Desai', initials: 'AD', color: '#3A6F4A', role: 'Associate', totalAssigned: 12, completed: 9, inProgress: 2, overdue: 1, onTimeRate: 87, avgDaysToComplete: 4.5 },
  { id: 'w8', name: 'Vikram Joshi', initials: 'VJ', color: '#8B5E3C', role: 'Associate', totalAssigned: 10, completed: 8, inProgress: 2, overdue: 0, onTimeRate: 100, avgDaysToComplete: 2.8 },
];
