// Static mock data for the notification panel preview.
// Reference date: 2026-04-17 (Friday). Week starts Monday (Apr 13).

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  category: 'filing' | 'client' | 'system' | 'assignment';
  timestamp: string; // ISO
  actor?: { name: string; initials: string };
}

export const MOCK_NOTIFICATIONS: AppNotification[] = [
  // ── Today (Apr 17) ────────────────────────────────────────────────
  {
    id: 'n1',
    title: 'GST-3B filing overdue',
    body: 'Filing for Reliance Industries — Q4 2025 is now past the due date. Immediate action required.',
    isRead: false,
    category: 'filing',
    timestamp: '2026-04-17T09:15:00Z',
    actor: { name: 'System', initials: 'SY' },
  },
  {
    id: 'n2',
    title: 'New client onboarded',
    body: 'Tata Consultancy Services has been added by Priya Sharma. 4 obligations are pending assignment.',
    isRead: false,
    category: 'client',
    timestamp: '2026-04-17T08:42:00Z',
    actor: { name: 'Priya Sharma', initials: 'PS' },
  },
  // ── Yesterday (Apr 16) ────────────────────────────────────────────
  {
    id: 'n3',
    title: 'Filing assigned to you',
    body: 'TDS quarterly return for Infosys Ltd — Q1 2026 has been assigned to you by Deepak Iyer.',
    isRead: false,
    category: 'assignment',
    timestamp: '2026-04-16T17:30:00Z',
    actor: { name: 'Deepak Iyer', initials: 'DI' },
  },
  {
    id: 'n4',
    title: 'ROC annual return due in 3 days',
    body: 'Wipro Technologies — Annual return (ROC-ANN) is due on 20 Apr 2026.',
    isRead: false,
    category: 'filing',
    timestamp: '2026-04-16T10:00:00Z',
    actor: { name: 'System', initials: 'SY' },
  },
  // ── This week (Apr 13–15) ─────────────────────────────────────────
  {
    id: 'n5',
    title: 'Filing marked as complete',
    body: 'PF monthly return for HCL Technologies — Mar 2026 was filed by Anita Desai.',
    isRead: true,
    category: 'filing',
    timestamp: '2026-04-15T14:22:00Z',
    actor: { name: 'Anita Desai', initials: 'AD' },
  },
  {
    id: 'n6',
    title: 'Bulk import completed',
    body: '12 obligations imported successfully for Mahindra Group. 2 duplicates were skipped.',
    isRead: true,
    category: 'system',
    timestamp: '2026-04-14T11:05:00Z',
    actor: { name: 'System', initials: 'SY' },
  },
  // ── This month (Apr 1–12) ─────────────────────────────────────────
  {
    id: 'n7',
    title: 'Client details updated',
    body: 'Tax identifier for Bajaj Finance Ltd was updated by Ravi Kumar.',
    isRead: true,
    category: 'client',
    timestamp: '2026-04-10T16:48:00Z',
    actor: { name: 'Ravi Kumar', initials: 'RK' },
  },
  {
    id: 'n8',
    title: 'ESI monthly filing due tomorrow',
    body: 'Adani Enterprises — ESI monthly return for Mar 2026 is due on 8 Apr 2026.',
    isRead: true,
    category: 'filing',
    timestamp: '2026-04-07T09:00:00Z',
    actor: { name: 'System', initials: 'SY' },
  },
  // ── Earlier (before April) ────────────────────────────────────────
  {
    id: 'n9',
    title: '2 filings reassigned',
    body: 'GST-1 and GST-3B for Sun Pharma were reassigned from Anita Desai to you.',
    isRead: true,
    category: 'assignment',
    timestamp: '2026-03-28T15:30:00Z',
    actor: { name: 'Deepak Iyer', initials: 'DI' },
  },
  {
    id: 'n10',
    title: 'Weekly compliance digest',
    body: '7 filings due this week across 4 clients. 2 are marked overdue. Review the filings dashboard for details.',
    isRead: true,
    category: 'system',
    timestamp: '2026-03-20T07:00:00Z',
    actor: { name: 'System', initials: 'SY' },
  },
];
