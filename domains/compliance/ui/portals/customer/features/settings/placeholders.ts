// ─── Types ──────────────────────────────────────────────────────────

export type SettingsSection =
  | 'profile'
  | 'security'
  | 'notifications'
  | 'appearance'
  | 'activity';

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  initials: string;
  color: string;
  roles: string[];
  positions: { title: string; unit: string }[];
  memberSince: string; // ISO
  lastActiveAt: string; // ISO
}

export interface ActiveSession {
  id: string;
  device: string;
  browser: string;
  ip: string;
  location: string;
  lastActiveAt: string; // ISO
  isCurrent: boolean;
}

export type NotificationChannel = 'email' | 'inApp';

export interface NotificationCategory {
  key: string;
  label: string;
  description: string;
  email: boolean;
  inApp: boolean;
}

export type ThemeMode = 'light' | 'dark' | 'system';
export type Density = 'comfortable' | 'compact';

export interface ActivityEntry {
  id: string;
  action: string;
  entity: string;
  detail: string;
  ip: string;
  timestamp: string; // ISO
}

// ─── Mock data ──────────────────────────────────────────────────────

export const CURRENT_USER: UserProfile = {
  id: 'usr-2',
  firstName: 'Deepak',
  lastName: 'Iyer',
  email: 'deepak@goelassociates.com',
  phone: '+919876543211',
  initials: 'DI',
  color: '#1D3461',
  roles: ['Super Admin', 'Partner'],
  positions: [{ title: 'Head', unit: 'Tax & Compliance' }],
  memberSince: '2025-06-01T00:00:00Z',
  lastActiveAt: '2026-04-17T08:42:00Z',
};

export const ACTIVE_SESSIONS: ActiveSession[] = [
  {
    id: 'sess-1',
    device: 'MacBook Pro',
    browser: 'Chrome 124',
    ip: '103.21.58.102',
    location: 'Mumbai, IN',
    lastActiveAt: '2026-04-17T08:42:00Z',
    isCurrent: true,
  },
  {
    id: 'sess-2',
    device: 'iPhone 15',
    browser: 'Safari Mobile',
    ip: '103.21.58.105',
    location: 'Mumbai, IN',
    lastActiveAt: '2026-04-16T19:30:00Z',
    isCurrent: false,
  },
  {
    id: 'sess-3',
    device: 'Windows Desktop',
    browser: 'Edge 124',
    ip: '49.36.112.87',
    location: 'Delhi, IN',
    lastActiveAt: '2026-04-14T11:15:00Z',
    isCurrent: false,
  },
];

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  {
    key: 'filing-deadlines',
    label: 'Filing deadlines',
    description: 'Reminders when filings are approaching their due date',
    email: true,
    inApp: true,
  },
  {
    key: 'filing-assigned',
    label: 'Filings assigned to me',
    description: 'When a filing is assigned to you or reassigned',
    email: true,
    inApp: true,
  },
  {
    key: 'filing-status',
    label: 'Filing status changes',
    description: 'When a filing you own or follow changes status',
    email: false,
    inApp: true,
  },
  {
    key: 'client-updates',
    label: 'Client updates',
    description: 'Changes to client details or compliance profile',
    email: false,
    inApp: true,
  },
  {
    key: 'team-mentions',
    label: 'Team mentions',
    description: 'When someone mentions you in a note or comment',
    email: true,
    inApp: true,
  },
  {
    key: 'overdue-alerts',
    label: 'Overdue alerts',
    description: 'Escalation when filings pass their deadline',
    email: true,
    inApp: true,
  },
  {
    key: 'weekly-digest',
    label: 'Weekly digest',
    description: 'Summary of compliance activity across your portfolio',
    email: true,
    inApp: false,
  },
  {
    key: 'system-announcements',
    label: 'System announcements',
    description: 'Platform updates, maintenance windows, and new features',
    email: true,
    inApp: true,
  },
];

export const ACTIVITY_LOG: ActivityEntry[] = [
  {
    id: 'act-1',
    action: 'Signed in',
    entity: 'Session',
    detail: 'Chrome 124 on MacBook Pro',
    ip: '103.21.58.102',
    timestamp: '2026-04-17T08:42:00Z',
  },
  {
    id: 'act-2',
    action: 'Updated filing',
    entity: 'GST R-1 — Mehta Textiles',
    detail: 'Changed status from Draft to In Review',
    ip: '103.21.58.102',
    timestamp: '2026-04-17T07:15:00Z',
  },
  {
    id: 'act-3',
    action: 'Added note',
    entity: 'TDS Return — Apex Industries',
    detail: 'Added compliance note',
    ip: '103.21.58.102',
    timestamp: '2026-04-16T17:20:00Z',
  },
  {
    id: 'act-4',
    action: 'Submitted filing',
    entity: 'ROC Annual Return — Kapoor Holdings',
    detail: 'Filing submitted to authority',
    ip: '103.21.58.102',
    timestamp: '2026-04-16T14:05:00Z',
  },
  {
    id: 'act-5',
    action: 'Changed password',
    entity: 'Account',
    detail: 'Password updated successfully',
    ip: '103.21.58.102',
    timestamp: '2026-04-15T10:30:00Z',
  },
  {
    id: 'act-6',
    action: 'Exported report',
    entity: 'Compliance Summary',
    detail: 'PDF export — Q4 2025-26',
    ip: '103.21.58.102',
    timestamp: '2026-04-14T16:45:00Z',
  },
  {
    id: 'act-7',
    action: 'Updated client',
    entity: 'Sharma & Co',
    detail: 'Updated compliance contact details',
    ip: '49.36.112.87',
    timestamp: '2026-04-14T11:10:00Z',
  },
  {
    id: 'act-8',
    action: 'Signed in',
    entity: 'Session',
    detail: 'Edge 124 on Windows Desktop',
    ip: '49.36.112.87',
    timestamp: '2026-04-14T11:00:00Z',
  },
  {
    id: 'act-9',
    action: 'Assigned filing',
    entity: 'Income Tax Return — Patel Group',
    detail: 'Assigned to Ravi Kumar',
    ip: '103.21.58.102',
    timestamp: '2026-04-13T09:20:00Z',
  },
  {
    id: 'act-10',
    action: 'Created filing',
    entity: 'GST R-3B — New Horizons Ltd',
    detail: 'New filing created for Apr 2026',
    ip: '103.21.58.102',
    timestamp: '2026-04-12T15:30:00Z',
  },
  {
    id: 'act-11',
    action: 'Revoked session',
    entity: 'Session',
    detail: 'Firefox on iPad — session terminated',
    ip: '103.21.58.102',
    timestamp: '2026-04-10T08:45:00Z',
  },
  {
    id: 'act-12',
    action: 'Updated profile',
    entity: 'Account',
    detail: 'Updated phone number',
    ip: '103.21.58.105',
    timestamp: '2026-04-08T20:15:00Z',
  },
];

// ─── Section nav items ──────────────────────────────────────────────

export const SETTINGS_SECTIONS: { key: SettingsSection; label: string }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'security', label: 'Security' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'appearance', label: 'Appearance' },
  { key: 'activity', label: 'Activity log' },
];
