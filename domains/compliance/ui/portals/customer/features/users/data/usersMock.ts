// ─── Types ──────────────────────────────────────────────────────────

export type UserStatus = 'active' | 'invited' | 'deactivated';

export interface UserRole {
  id: string;
  name: string;
}

export interface UserPosition {
  id: string;
  unitName: string; // org unit
  title: string; // position within that unit
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  initials: string;
  color: string; // avatar bg
  status: UserStatus;
  roles: UserRole[];
  positions: UserPosition[];
  lastActiveAt: string | null; // ISO
  createdAt: string; // ISO
}

// ─── Mock data ──────────────────────────────────────────────────────

export const MOCK_USERS: UserRow[] = [
  {
    id: 'usr-1',
    name: 'Ashish Goel',
    email: 'ashish@goelassociates.com',
    phone: '+919876543210',
    initials: 'AG',
    color: '#1D3461',
    status: 'active',
    roles: [
      { id: 'role-1', name: 'Super Admin' },
      { id: 'role-2', name: 'Partner' },
    ],
    positions: [
      { id: 'pos-1', unitName: 'Goel & Associates', title: 'Head' },
    ],
    lastActiveAt: '2026-04-17T09:15:00Z',
    createdAt: '2025-06-01T00:00:00Z',
  },
  {
    id: 'usr-2',
    name: 'Deepak Iyer',
    email: 'deepak@goelassociates.com',
    phone: '+919876543211',
    initials: 'DI',
    color: '#1D3461',
    status: 'active',
    roles: [
      { id: 'role-1', name: 'Super Admin' },
      { id: 'role-2', name: 'Partner' },
    ],
    positions: [
      { id: 'pos-2', unitName: 'Tax & Compliance', title: 'Head' },
    ],
    lastActiveAt: '2026-04-17T08:42:00Z',
    createdAt: '2025-06-01T00:00:00Z',
  },
  {
    id: 'usr-3',
    name: 'Ravi Kumar',
    email: 'ravi@goelassociates.com',
    phone: '+919876543212',
    initials: 'RK',
    color: '#3A6F4A',
    status: 'active',
    roles: [
      { id: 'role-3', name: 'Manager' },
    ],
    positions: [
      { id: 'pos-3', unitName: 'GST Returns', title: 'Head' },
    ],
    lastActiveAt: '2026-04-16T17:30:00Z',
    createdAt: '2025-09-15T00:00:00Z',
  },
  {
    id: 'usr-4',
    name: 'Meera Reddy',
    email: 'meera@goelassociates.com',
    phone: '+919876543213',
    initials: 'MR',
    color: '#8B5E3C',
    status: 'active',
    roles: [
      { id: 'role-3', name: 'Manager' },
    ],
    positions: [
      { id: 'pos-4', unitName: 'Income Tax', title: 'Head' },
    ],
    lastActiveAt: '2026-04-17T07:20:00Z',
    createdAt: '2025-10-01T00:00:00Z',
  },
  {
    id: 'usr-5',
    name: 'Sanjay Mehta',
    email: 'sanjay@goelassociates.com',
    phone: '+919876543214',
    initials: 'SM',
    color: '#5B4A8A',
    status: 'active',
    roles: [
      { id: 'role-3', name: 'Manager' },
    ],
    positions: [
      { id: 'pos-5', unitName: 'Audit & Assurance', title: 'Head' },
    ],
    lastActiveAt: '2026-04-16T14:10:00Z',
    createdAt: '2025-10-15T00:00:00Z',
  },
  {
    id: 'usr-6',
    name: 'Rahul Gupta',
    email: 'rahul@goelassociates.com',
    phone: '+919876543215',
    initials: 'RG',
    color: '#1D3461',
    status: 'active',
    roles: [
      { id: 'role-4', name: 'Associate' },
    ],
    positions: [
      { id: 'pos-6', unitName: 'ROC Filings', title: 'Head' },
    ],
    lastActiveAt: '2026-04-17T10:05:00Z',
    createdAt: '2025-11-01T00:00:00Z',
  },
  {
    id: 'usr-7',
    name: 'Sneha Patel',
    email: 'sneha@goelassociates.com',
    phone: '+919876543216',
    initials: 'SP',
    color: '#8B5E3C',
    status: 'active',
    roles: [
      { id: 'role-4', name: 'Associate' },
    ],
    positions: [
      { id: 'pos-7', unitName: 'TDS & Payroll', title: 'Head' },
    ],
    lastActiveAt: '2026-04-15T16:45:00Z',
    createdAt: '2025-11-20T00:00:00Z',
  },
  {
    id: 'usr-8',
    name: 'Priya Sharma',
    email: 'priya@goelassociates.com',
    phone: '+919876543217',
    initials: 'PS',
    color: '#C6541D',
    status: 'active',
    roles: [
      { id: 'role-3', name: 'Manager' },
    ],
    positions: [
      { id: 'pos-8', unitName: 'Goel & Associates', title: 'Manager' },
    ],
    lastActiveAt: '2026-04-17T11:30:00Z',
    createdAt: '2025-08-10T00:00:00Z',
  },
  {
    id: 'usr-9',
    name: 'Neha Kapoor',
    email: 'neha@goelassociates.com',
    phone: '+919876543218',
    initials: 'NK',
    color: '#5B4A8A',
    status: 'active',
    roles: [
      { id: 'role-4', name: 'Associate' },
    ],
    positions: [
      { id: 'pos-9', unitName: 'Tax & Compliance', title: 'Senior' },
    ],
    lastActiveAt: '2026-04-16T09:20:00Z',
    createdAt: '2026-01-08T00:00:00Z',
  },
  {
    id: 'usr-10',
    name: 'Anita Desai',
    email: 'anita@goelassociates.com',
    phone: '+919876543219',
    initials: 'AD',
    color: '#3A6F4A',
    status: 'active',
    roles: [
      { id: 'role-4', name: 'Associate' },
    ],
    positions: [
      { id: 'pos-10', unitName: 'GST Returns', title: 'Executive' },
    ],
    lastActiveAt: '2026-04-14T13:00:00Z',
    createdAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'usr-11',
    name: 'Vikram Joshi',
    email: 'vikram@goelassociates.com',
    phone: '+919876543220',
    initials: 'VJ',
    color: '#8B5E3C',
    status: 'active',
    roles: [
      { id: 'role-5', name: 'Viewer' },
    ],
    positions: [
      { id: 'pos-11', unitName: 'GST Returns', title: 'Executive' },
    ],
    lastActiveAt: '2026-04-10T15:00:00Z',
    createdAt: '2026-02-01T00:00:00Z',
  },
  {
    id: 'usr-12',
    name: 'Kavita Singh',
    email: 'kavita@goelassociates.com',
    phone: '+919876543221',
    initials: 'KS',
    color: '#C6541D',
    status: 'invited',
    roles: [
      { id: 'role-4', name: 'Associate' },
    ],
    positions: [
      { id: 'pos-12', unitName: 'Audit & Assurance', title: 'Senior' },
    ],
    lastActiveAt: null,
    createdAt: '2026-04-10T00:00:00Z',
  },
  {
    id: 'usr-13',
    name: 'Arjun Nair',
    email: 'arjun@goelassociates.com',
    phone: '+919876543222',
    initials: 'AN',
    color: '#1D3461',
    status: 'invited',
    roles: [
      { id: 'role-4', name: 'Associate' },
    ],
    positions: [
      { id: 'pos-13', unitName: 'Income Tax', title: 'Executive' },
    ],
    lastActiveAt: null,
    createdAt: '2026-04-12T00:00:00Z',
  },
  {
    id: 'usr-14',
    name: 'Aditya Rao',
    email: 'aditya@goelassociates.com',
    phone: '+919876543223',
    initials: 'AR',
    color: '#5B4A8A',
    status: 'deactivated',
    roles: [
      { id: 'role-5', name: 'Viewer' },
    ],
    positions: [
      { id: 'pos-14', unitName: 'TDS & Payroll', title: 'Executive' },
    ],
    lastActiveAt: '2026-03-01T10:00:00Z',
    createdAt: '2025-12-05T00:00:00Z',
  },
  {
    id: 'usr-15',
    name: 'Lakshmi Venkat',
    email: 'lakshmi@goelassociates.com',
    phone: '+919876543224',
    initials: 'LV',
    color: '#3A6F4A',
    status: 'deactivated',
    roles: [],
    positions: [],
    lastActiveAt: '2026-02-15T08:00:00Z',
    createdAt: '2025-11-01T00:00:00Z',
  },
];

// ─── Aggregates ─────────────────────────────────────────────────────

export const USER_STATUS_COUNTS: Record<UserStatus | 'all', number> = {
  all: MOCK_USERS.length,
  active: MOCK_USERS.filter((u) => u.status === 'active').length,
  invited: MOCK_USERS.filter((u) => u.status === 'invited').length,
  deactivated: MOCK_USERS.filter((u) => u.status === 'deactivated').length,
};

// All unique role names across users for filter options
export const ALL_ROLE_OPTIONS = (() => {
  const map = new Map<string, string>();
  for (const u of MOCK_USERS) {
    for (const r of u.roles) {
      map.set(r.id, r.name);
    }
  }
  return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
})();
