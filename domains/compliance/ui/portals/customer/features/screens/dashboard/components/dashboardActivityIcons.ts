import { FileText, Paperclip, UserPlus, GitBranch, MessageSquare } from 'lucide-react';
import type { TimelineIconConfig } from '@packages/ui';

export const DASHBOARD_ACTIVITY_ICONS: Record<string, TimelineIconConfig> = {
  'filing-submitted': {
    icon: FileText,
    bg: 'bg-filed/10',
    ring: 'ring-filed/30',
    iconColor: 'text-filed',
  },
  'attachment-added': {
    icon: Paperclip,
    bg: 'bg-ink/5',
    ring: 'ring-ink/15',
    iconColor: 'text-ink-muted',
  },
  assigned: {
    icon: UserPlus,
    bg: 'bg-due-soon/10',
    ring: 'ring-due-soon/30',
    iconColor: 'text-due-soon',
  },
  'status-change': {
    icon: GitBranch,
    bg: 'bg-authority/10',
    ring: 'ring-authority/30',
    iconColor: 'text-authority',
  },
  'note-added': {
    icon: MessageSquare,
    bg: 'bg-ink/5',
    ring: 'ring-ink/15',
    iconColor: 'text-ink-muted',
  },
};
