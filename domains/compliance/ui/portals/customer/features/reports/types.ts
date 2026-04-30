// Display types consumed by the reports page columns + chart components.
// API payloads are translated into these shapes inside ReportsPage.

export type ReportTab = 'compliance' | 'overdue' | 'workload';

export interface ComplianceRow {
  id: string;
  clientName: string;
  initials: string;
  color: string;
  totalFilings: number;
  onTime: number;
  late: number;
  overdue: number;
  onTimeRate: number;
}

export interface OverdueRow {
  id: string;
  filingName: string;
  lawCode: string;
  clientName: string;
  clientInitials: string;
  clientColor: string;
  dueDate: string;
  daysOverdue: number;
  handler: string;
  handlerInitials: string;
  priority: 'critical' | 'high' | 'medium';
}

export interface AgingBucket {
  label: string;
  range: string;
  count: number;
  tone: 'due-soon' | 'signal';
}

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
  onTimeRate: number;
  avgDaysToComplete: number;
}
