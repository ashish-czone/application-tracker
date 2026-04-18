// Static fixtures for the Dashboard screen preview. Local to this feature so
// the screen can evolve independently of the console-preview design kit.

import type { TimelineEvent } from '@packages/ui';

export type { TimelineEvent as ActivityEvent };

export const DASHBOARD_ACTIVITY: TimelineEvent[] = [
  {
    id: 'a1',
    type: 'filing-submitted',
    actor: { name: 'Priya Shankar', initials: 'PS' },
    timestamp: '2026-04-17T11:46:00Z',
    detail: 'Filed GSTR-3B · Aarav Industries — Mar 2026',
  },
  {
    id: 'a2',
    type: 'attachment-added',
    actor: { name: 'Arjun Mehta', initials: 'AM' },
    timestamp: '2026-04-17T11:00:00Z',
    detail: 'Uploaded working file for TDS 26Q · Cedar Retail',
  },
  {
    id: 'a3',
    type: 'assigned',
    actor: { name: 'Kavita Rao', initials: 'KR' },
    timestamp: '2026-04-17T10:00:00Z',
    detail: 'Reassigned GSTR-1 · Bluewave Exports — from Arjun to Priya',
  },
  {
    id: 'a4',
    type: 'status-change',
    actor: { name: 'Priya Shankar', initials: 'PS' },
    timestamp: '2026-04-17T09:00:00Z',
    detail: 'Flagged ITR-6 · Drift Media — awaiting client confirmation',
  },
  {
    id: 'a5',
    type: 'status-change',
    actor: { name: 'Deepak Iyer', initials: 'DI' },
    timestamp: '2026-04-16T14:00:00Z',
    detail: 'Approved GSTR-9 · Evergreen Labs',
  },
  {
    id: 'a6',
    type: 'note-added',
    actor: { name: 'Kavita Rao', initials: 'KR' },
    timestamp: '2026-04-16T11:30:00Z',
    detail: 'Added note on ROC MGT-7 · Fable Studios — "waiting on board resolution"',
  },
  {
    id: 'a7',
    type: 'filing-submitted',
    actor: { name: 'Arjun Mehta', initials: 'AM' },
    timestamp: '2026-04-15T16:00:00Z',
    detail: 'Marked filed GSTR-3B · Cedar Retail',
  },
];
