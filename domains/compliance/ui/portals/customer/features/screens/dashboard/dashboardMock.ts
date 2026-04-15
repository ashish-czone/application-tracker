// Static fixtures for the Dashboard screen preview. Local to this feature so
// the screen can evolve independently of the console-preview design kit.

export interface ActivityEvent {
  id: string;
  actor: { name: string; initials: string };
  action: string; // past-tense verb phrase
  target: string; // filing / client / law
  context?: string; // optional trailing clause
  at: string; // relative label — "2h ago", "yesterday"
}

export const DASHBOARD_ACTIVITY: ActivityEvent[] = [
  {
    id: 'a1',
    actor: { name: 'Priya Shankar', initials: 'PS' },
    action: 'filed',
    target: 'GSTR-3B · Aarav Industries',
    context: 'Mar 2026',
    at: '14 min ago',
  },
  {
    id: 'a2',
    actor: { name: 'Arjun Mehta', initials: 'AM' },
    action: 'uploaded working file for',
    target: 'TDS 26Q · Cedar Retail',
    at: '1h ago',
  },
  {
    id: 'a3',
    actor: { name: 'Kavita Rao', initials: 'KR' },
    action: 'reassigned',
    target: 'GSTR-1 · Bluewave Exports',
    context: 'from Arjun to Priya',
    at: '2h ago',
  },
  {
    id: 'a4',
    actor: { name: 'Priya Shankar', initials: 'PS' },
    action: 'flagged',
    target: 'ITR-6 · Drift Media',
    context: 'awaiting client confirmation',
    at: '3h ago',
  },
  {
    id: 'a5',
    actor: { name: 'Deepak Iyer', initials: 'DI' },
    action: 'approved',
    target: 'GSTR-9 · Evergreen Labs',
    at: 'yesterday',
  },
  {
    id: 'a6',
    actor: { name: 'Kavita Rao', initials: 'KR' },
    action: 'added note on',
    target: 'ROC MGT-7 · Fable Studios',
    context: '"waiting on board resolution"',
    at: 'yesterday',
  },
  {
    id: 'a7',
    actor: { name: 'Arjun Mehta', initials: 'AM' },
    action: 'marked filed',
    target: 'GSTR-3B · Cedar Retail',
    at: '2 days ago',
  },
];
