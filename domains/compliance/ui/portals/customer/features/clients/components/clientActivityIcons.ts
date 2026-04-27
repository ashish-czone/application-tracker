import { FileText, UserPlus, MessageSquare, GitBranch, Plus } from 'lucide-react';
import type { TimelineIconConfig } from '@packages/ui';

export const CLIENT_ACTIVITY_ICONS: Record<string, TimelineIconConfig> = {
  'filing-submitted': {
    icon: FileText,
    bg: 'bg-filed/10',
    ring: 'ring-filed/30',
    iconColor: 'text-filed',
  },
  'handler-changed': {
    icon: UserPlus,
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
  'status-change': {
    icon: GitBranch,
    bg: 'bg-due-soon/10',
    ring: 'ring-due-soon/30',
    iconColor: 'text-due-soon',
  },
  'law-added': {
    icon: Plus,
    bg: 'bg-authority/10',
    ring: 'ring-authority/30',
    iconColor: 'text-authority',
  },
};
