// ─── Types ──────────────────────────────────────────────────────────

export type OrgLevel = 'company' | 'entity' | 'division';

export type HealthStatus = 'healthy' | 'at-risk' | 'critical';

export interface OrgUnit {
  id: string;
  name: string;
  code: string;
  level: OrgLevel;
  parentId: string | null;
  description: string;
  headId: string | null;
  health: HealthStatus;
  /** Display order among siblings. */
  sortOrder: number;
}

export interface OrgMember {
  id: string;
  unitId: string;
  userId: string;
  name: string;
  initials: string;
  email: string;
  position: 'head' | 'manager' | 'senior' | 'executive';
}

export interface ComplianceLawAssignment {
  id: string;
  unitId: string;
  lawCode: string;
  lawName: string;
  totalObligations: number;
  compliant: number;
  overdue: number;
}

// ─── Level metadata ─────────────────────────────────────────────────

export const LEVEL_META: Record<OrgLevel, { label: string; color: string }> = {
  company: { label: 'Company', color: 'bg-authority text-paper' },
  entity: { label: 'Entity', color: 'bg-ink text-paper' },
  division: { label: 'Division', color: 'bg-ink-muted text-paper' },
};

// ─── Mock org units ─────────────────────────────────────────────────

export const MOCK_ORG_UNITS: OrgUnit[] = [
  // Root — Company
  {
    id: 'org-1',
    name: 'Goel & Associates',
    code: 'GA',
    level: 'company',
    parentId: null,
    description: 'Chartered Accountants and Company Secretaries. Full-service compliance advisory firm providing regulatory, tax, and corporate governance services.',
    headId: 'usr-1',
    health: 'at-risk',
    sortOrder: 0,
  },

  // Entities
  {
    id: 'org-2',
    name: 'Tax & Regulatory',
    code: 'TAX',
    level: 'entity',
    parentId: 'org-1',
    description: 'Handles all direct and indirect tax compliance — GST, Income Tax, TDS, Professional Tax. Responsible for return filing, assessments, and advisory.',
    headId: 'usr-2',
    health: 'at-risk',
    sortOrder: 0,
  },
  {
    id: 'org-3',
    name: 'Corporate & Secretarial',
    code: 'CS',
    level: 'entity',
    parentId: 'org-1',
    description: 'Company law compliance — ROC filings, board resolutions, annual returns, FEMA compliance, and corporate governance advisory.',
    headId: 'usr-5',
    health: 'healthy',
    sortOrder: 1,
  },

  // Divisions under Tax & Regulatory
  {
    id: 'org-4',
    name: 'GST Division',
    code: 'GST',
    level: 'division',
    parentId: 'org-2',
    description: 'Monthly and quarterly GST return filing — GSTR-1, GSTR-3B, GSTR-9. Input tax credit reconciliation and audit.',
    headId: 'usr-3',
    health: 'critical',
    sortOrder: 0,
  },
  {
    id: 'org-5',
    name: 'Income Tax Division',
    code: 'ITR',
    level: 'division',
    parentId: 'org-2',
    description: 'Income tax return filing, advance tax computation, TDS compliance, assessment proceedings, and appeals.',
    headId: 'usr-4',
    health: 'at-risk',
    sortOrder: 1,
  },
  {
    id: 'org-6',
    name: 'Payroll Compliance',
    code: 'PAY',
    level: 'division',
    parentId: 'org-2',
    description: 'Provident Fund, ESI, Professional Tax — monthly contributions, returns, and annual reconciliation.',
    headId: null,
    health: 'healthy',
    sortOrder: 2,
  },

  // Divisions under Corporate & Secretarial
  {
    id: 'org-7',
    name: 'ROC Filings',
    code: 'ROC',
    level: 'division',
    parentId: 'org-3',
    description: 'Registrar of Companies — annual returns, charge registration, director changes, share transfers, and statutory registers.',
    headId: 'usr-6',
    health: 'healthy',
    sortOrder: 0,
  },
  {
    id: 'org-8',
    name: 'Audit & Assurance',
    code: 'AUD',
    level: 'division',
    parentId: 'org-3',
    description: 'Statutory audit, internal audit, tax audit, CARO compliance, and management letter preparation.',
    headId: 'usr-7',
    health: 'healthy',
    sortOrder: 1,
  },
];

// ─── Mock members ───────────────────────────────────────────────────

export const MOCK_MEMBERS: OrgMember[] = [
  // Company level
  { id: 'm-1', unitId: 'org-1', userId: 'usr-1', name: 'Ashish Goel', initials: 'AG', email: 'ashish@goelassociates.com', position: 'head' },
  { id: 'm-2', unitId: 'org-1', userId: 'usr-9', name: 'Priya Sharma', initials: 'PS', email: 'priya@goelassociates.com', position: 'manager' },

  // Tax & Regulatory
  { id: 'm-3', unitId: 'org-2', userId: 'usr-2', name: 'Deepak Iyer', initials: 'DI', email: 'deepak@goelassociates.com', position: 'head' },
  { id: 'm-4', unitId: 'org-2', userId: 'usr-10', name: 'Neha Kapoor', initials: 'NK', email: 'neha@goelassociates.com', position: 'senior' },

  // Corporate & Secretarial
  { id: 'm-5', unitId: 'org-3', userId: 'usr-5', name: 'Sanjay Mehta', initials: 'SM', email: 'sanjay@goelassociates.com', position: 'head' },

  // GST Division
  { id: 'm-6', unitId: 'org-4', userId: 'usr-3', name: 'Ravi Kumar', initials: 'RK', email: 'ravi@goelassociates.com', position: 'head' },
  { id: 'm-7', unitId: 'org-4', userId: 'usr-11', name: 'Anita Desai', initials: 'AD', email: 'anita@goelassociates.com', position: 'executive' },
  { id: 'm-8', unitId: 'org-4', userId: 'usr-12', name: 'Vikram Joshi', initials: 'VJ', email: 'vikram@goelassociates.com', position: 'executive' },

  // Income Tax Division
  { id: 'm-9', unitId: 'org-5', userId: 'usr-4', name: 'Meera Reddy', initials: 'MR', email: 'meera@goelassociates.com', position: 'head' },
  { id: 'm-10', unitId: 'org-5', userId: 'usr-13', name: 'Arjun Nair', initials: 'AN', email: 'arjun@goelassociates.com', position: 'executive' },

  // Payroll Compliance (no head)
  { id: 'm-11', unitId: 'org-6', userId: 'usr-14', name: 'Kavita Singh', initials: 'KS', email: 'kavita@goelassociates.com', position: 'senior' },

  // ROC Filings
  { id: 'm-12', unitId: 'org-7', userId: 'usr-6', name: 'Rahul Gupta', initials: 'RG', email: 'rahul@goelassociates.com', position: 'head' },

  // Audit & Assurance
  { id: 'm-13', unitId: 'org-8', userId: 'usr-7', name: 'Sneha Patel', initials: 'SP', email: 'sneha@goelassociates.com', position: 'head' },
  { id: 'm-14', unitId: 'org-8', userId: 'usr-15', name: 'Aditya Rao', initials: 'AR', email: 'aditya@goelassociates.com', position: 'executive' },
];

// ─── Mock law assignments ───────────────────────────────────────────

export const MOCK_LAW_ASSIGNMENTS: ComplianceLawAssignment[] = [
  // GST Division
  { id: 'la-1', unitId: 'org-4', lawCode: 'GST', lawName: 'Goods & Services Tax Act', totalObligations: 12, compliant: 8, overdue: 3 },

  // Income Tax Division
  { id: 'la-2', unitId: 'org-5', lawCode: 'ITR', lawName: 'Income Tax Act, 1961', totalObligations: 8, compliant: 5, overdue: 1 },
  { id: 'la-3', unitId: 'org-5', lawCode: 'TDS', lawName: 'TDS/TCS Provisions', totalObligations: 6, compliant: 5, overdue: 1 },

  // Payroll Compliance
  { id: 'la-4', unitId: 'org-6', lawCode: 'PF', lawName: 'Provident Fund Act', totalObligations: 4, compliant: 4, overdue: 0 },
  { id: 'la-5', unitId: 'org-6', lawCode: 'ESI', lawName: 'ESI Act, 1948', totalObligations: 4, compliant: 4, overdue: 0 },
  { id: 'la-6', unitId: 'org-6', lawCode: 'PT', lawName: 'Professional Tax', totalObligations: 3, compliant: 3, overdue: 0 },

  // ROC Filings
  { id: 'la-7', unitId: 'org-7', lawCode: 'ROC', lawName: 'Companies Act, 2013', totalObligations: 10, compliant: 9, overdue: 0 },

  // Audit & Assurance
  { id: 'la-8', unitId: 'org-8', lawCode: 'AUD', lawName: 'Audit Standards (SA)', totalObligations: 6, compliant: 6, overdue: 0 },
];

// ─── Helpers ────────────────────────────────────────────────────────

export function getUnitChildren(units: OrgUnit[], parentId: string): OrgUnit[] {
  return units
    .filter((u) => u.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getUnitMembers(members: OrgMember[], unitId: string): OrgMember[] {
  return members.filter((m) => m.unitId === unitId);
}

export function getUnitHead(members: OrgMember[], headId: string | null): OrgMember | undefined {
  if (!headId) return undefined;
  return members.find((m) => m.userId === headId);
}

export function getUnitLawAssignments(assignments: ComplianceLawAssignment[], unitId: string): ComplianceLawAssignment[] {
  return assignments.filter((a) => a.unitId === unitId);
}

/** Build breadcrumb trail from root to the given unit. */
export function buildBreadcrumb(units: OrgUnit[], unitId: string): OrgUnit[] {
  const trail: OrgUnit[] = [];
  let current = units.find((u) => u.id === unitId);
  while (current) {
    trail.unshift(current);
    current = current.parentId ? units.find((u) => u.id === current!.parentId) : undefined;
  }
  return trail;
}

export const POSITION_LABEL: Record<OrgMember['position'], string> = {
  head: 'Head',
  manager: 'Manager',
  senior: 'Senior',
  executive: 'Executive',
};
