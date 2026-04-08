import { Badge } from '@packages/ui';
import { formatLabel } from '@packages/common';

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  // Candidate statuses
  'new': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  'in-review': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  'qualified': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'unqualified': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' },
  'junk-candidate': { bg: 'bg-gray-50', text: 'text-gray-500', dot: 'bg-gray-400' },
  'contacted': { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  'contact-in-future': { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500' },
  'not-contacted': { bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400' },
  'attempted-to-contact': { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  'reviewed': { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500' },

  // Job opening statuses
  'in-progress': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  'waiting-for-approval': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  'on-hold': { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-400' },
  'filled': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'cancelled': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' },
  'declined': { bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-400' },
  'inactive': { bg: 'bg-gray-50', text: 'text-gray-500', dot: 'bg-gray-400' },
  'submitted-by-client': { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },

  // Interview statuses
  'scheduled': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  'completed': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'no-show': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' },
  'rescheduled': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },

  // Application stages
  'phone-screen': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  'technical': { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  'on-site': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  'final': { bg: 'bg-pink-50', text: 'text-pink-700', dot: 'bg-pink-500' },
  'offer': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'hired': { bg: 'bg-green-50', text: 'text-green-800', dot: 'bg-green-600' },
  'rejected': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' },
  'withdrawn': { bg: 'bg-gray-50', text: 'text-gray-500', dot: 'bg-gray-400' },

  // Task statuses
  'open': { bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400' },
  'in_progress': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  'done': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
};

const DEFAULT_COLORS = { bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400' };

export function StatusBadgeRenderer({ value }: { value: unknown; row: Record<string, unknown>; entityType: string }) {
  if (!value || typeof value !== 'string') return <span className="text-sm text-muted-foreground">-</span>;
  const colors = STATUS_COLORS[value] ?? DEFAULT_COLORS;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
      {formatLabel(value)}
    </span>
  );
}
