// ─── Types ──────────────────────────────────────────────────────────

export interface Permission {
  name: string;
  label: string;
  module: string;
}

export interface RoleMember {
  id: string;
  name: string;
  email: string;
  initials: string;
  addedAt: string; // ISO
}

export interface Role {
  id: string;
  name: string;
  isSystem: boolean;
  isDefault: boolean;
  userCount: number;
  createdAt: string; // ISO
  permissions: string[]; // permission names
  members: RoleMember[];
}

// ─── Permission registry ────────────────────────────────────────────

export const PERMISSION_REGISTRY: Permission[] = [
  // Users
  { name: 'users.read', label: 'View users', module: 'Users' },
  { name: 'users.create', label: 'Create users', module: 'Users' },
  { name: 'users.update', label: 'Edit users', module: 'Users' },
  { name: 'users.delete', label: 'Delete users', module: 'Users' },

  // Roles & Permissions
  { name: 'rbac.roles.read', label: 'View roles', module: 'Roles & Permissions' },
  { name: 'rbac.roles.manage', label: 'Manage roles', module: 'Roles & Permissions' },
  { name: 'rbac.permissions.read', label: 'View permissions', module: 'Roles & Permissions' },

  // Clients
  { name: 'clients.read', label: 'View clients', module: 'Clients' },
  { name: 'clients.create', label: 'Create clients', module: 'Clients' },
  { name: 'clients.update', label: 'Edit clients', module: 'Clients' },
  { name: 'clients.delete', label: 'Delete clients', module: 'Clients' },

  // Laws / Obligations
  { name: 'laws.read', label: 'View laws', module: 'Laws' },
  { name: 'laws.create', label: 'Add laws', module: 'Laws' },
  { name: 'laws.update', label: 'Edit laws', module: 'Laws' },
  { name: 'laws.delete', label: 'Remove laws', module: 'Laws' },

  // Filings
  { name: 'filings.read', label: 'View filings', module: 'Filings' },
  { name: 'filings.create', label: 'Create filings', module: 'Filings' },
  { name: 'filings.update', label: 'Edit filings', module: 'Filings' },
  { name: 'filings.delete', label: 'Delete filings', module: 'Filings' },
  { name: 'filings.submit', label: 'Submit filings', module: 'Filings' },
  { name: 'filings.approve', label: 'Approve filings', module: 'Filings' },

  // Organisation
  { name: 'org.read', label: 'View org structure', module: 'Organisation' },
  { name: 'org.manage', label: 'Manage org units', module: 'Organisation' },

  // Reports
  { name: 'reports.read', label: 'View reports', module: 'Reports' },
  { name: 'reports.export', label: 'Export reports', module: 'Reports' },

  // Settings
  { name: 'settings.read', label: 'View settings', module: 'Settings' },
  { name: 'settings.manage', label: 'Manage settings', module: 'Settings' },

  // Audit
  { name: 'audit.read', label: 'View audit trail', module: 'Audit' },
];

// Group permissions by module for the UI
export function groupPermissionsByModule(): { module: string; permissions: Permission[] }[] {
  const map = new Map<string, Permission[]>();
  for (const p of PERMISSION_REGISTRY) {
    const group = map.get(p.module) ?? [];
    group.push(p);
    map.set(p.module, group);
  }
  return Array.from(map.entries()).map(([module, permissions]) => ({ module, permissions }));
}

// ─── Mock members pool ──────────────────────────────────────────────

const MEMBER_POOL: RoleMember[] = [
  { id: 'u1', name: 'Deepak Iyer', email: 'deepak@firm.example', initials: 'DI', addedAt: '2025-09-15T10:00:00Z' },
  { id: 'u2', name: 'Priya Shankar', email: 'priya@firm.example', initials: 'PS', addedAt: '2025-10-01T09:00:00Z' },
  { id: 'u3', name: 'Arjun Mehta', email: 'arjun@firm.example', initials: 'AM', addedAt: '2025-10-12T14:30:00Z' },
  { id: 'u4', name: 'Kavita Rao', email: 'kavita@firm.example', initials: 'KR', addedAt: '2025-11-01T08:00:00Z' },
  { id: 'u5', name: 'Ravi Kumar', email: 'ravi@firm.example', initials: 'RK', addedAt: '2025-11-20T11:00:00Z' },
  { id: 'u6', name: 'Anita Desai', email: 'anita@firm.example', initials: 'AD', addedAt: '2025-12-05T10:00:00Z' },
  { id: 'u7', name: 'Suresh Nair', email: 'suresh@firm.example', initials: 'SN', addedAt: '2026-01-08T09:30:00Z' },
  { id: 'u8', name: 'Meena Patel', email: 'meena@firm.example', initials: 'MP', addedAt: '2026-01-15T10:00:00Z' },
  { id: 'u9', name: 'Vikram Singh', email: 'vikram@firm.example', initials: 'VS', addedAt: '2026-02-01T08:00:00Z' },
  { id: 'u10', name: 'Neha Gupta', email: 'neha@firm.example', initials: 'NG', addedAt: '2026-02-20T14:00:00Z' },
  { id: 'u11', name: 'Amit Joshi', email: 'amit@firm.example', initials: 'AJ', addedAt: '2026-03-01T10:00:00Z' },
  { id: 'u12', name: 'Lakshmi Venkat', email: 'lakshmi@firm.example', initials: 'LV', addedAt: '2026-03-10T09:00:00Z' },
];

// All permission names for convenience
const ALL_PERMS = PERMISSION_REGISTRY.map((p) => p.name);

// ─── Mock roles ─────────────────────────────────────────────────────

export const MOCK_ROLES: Role[] = [
  {
    id: 'role-1',
    name: 'Super Admin',
    isSystem: true,
    isDefault: false,
    userCount: 2,
    createdAt: '2025-06-01T00:00:00Z',
    permissions: ALL_PERMS,
    members: [MEMBER_POOL[0], MEMBER_POOL[1]],
  },
  {
    id: 'role-2',
    name: 'Partner',
    isSystem: false,
    isDefault: false,
    userCount: 3,
    createdAt: '2025-08-10T00:00:00Z',
    permissions: [
      'users.read', 'users.create', 'users.update',
      'rbac.roles.read',
      'clients.read', 'clients.create', 'clients.update', 'clients.delete',
      'laws.read', 'laws.create', 'laws.update', 'laws.delete',
      'filings.read', 'filings.create', 'filings.update', 'filings.delete', 'filings.submit', 'filings.approve',
      'org.read', 'org.manage',
      'reports.read', 'reports.export',
      'settings.read', 'settings.manage',
      'audit.read',
    ],
    members: [MEMBER_POOL[0], MEMBER_POOL[2], MEMBER_POOL[5]],
  },
  {
    id: 'role-3',
    name: 'Manager',
    isSystem: false,
    isDefault: true,
    userCount: 4,
    createdAt: '2025-09-01T00:00:00Z',
    permissions: [
      'users.read',
      'rbac.roles.read',
      'clients.read', 'clients.create', 'clients.update',
      'laws.read',
      'filings.read', 'filings.create', 'filings.update', 'filings.submit',
      'org.read',
      'reports.read',
      'audit.read',
    ],
    members: [MEMBER_POOL[3], MEMBER_POOL[4], MEMBER_POOL[6], MEMBER_POOL[7]],
  },
  {
    id: 'role-4',
    name: 'Associate',
    isSystem: false,
    isDefault: false,
    userCount: 5,
    createdAt: '2025-10-15T00:00:00Z',
    permissions: [
      'clients.read',
      'laws.read',
      'filings.read', 'filings.create', 'filings.update', 'filings.submit',
      'reports.read',
    ],
    members: [MEMBER_POOL[8], MEMBER_POOL[9], MEMBER_POOL[10], MEMBER_POOL[11], MEMBER_POOL[4]],
  },
  {
    id: 'role-5',
    name: 'Viewer',
    isSystem: false,
    isDefault: false,
    userCount: 3,
    createdAt: '2026-01-20T00:00:00Z',
    permissions: [
      'clients.read',
      'laws.read',
      'filings.read',
      'org.read',
      'reports.read',
    ],
    members: [MEMBER_POOL[7], MEMBER_POOL[10], MEMBER_POOL[11]],
  },
];

// Users available to add (not already in a specific role)
export function getAvailableMembers(roleId: string): RoleMember[] {
  const role = MOCK_ROLES.find((r) => r.id === roleId);
  if (!role) return MEMBER_POOL;
  const assigned = new Set(role.members.map((m) => m.id));
  return MEMBER_POOL.filter((m) => !assigned.has(m.id));
}
