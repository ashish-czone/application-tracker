import { useMemo } from 'react';
import { cn } from '@packages/ui';

export type DetailTab = 'overview' | 'notes' | 'attachments' | 'evaluations' | 'audit-trail';

interface DetailPageTabsProps {
  activeTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  hasNotes?: boolean;
  hasAttachments?: boolean;
  hasEvaluations?: boolean;
}

export function DetailPageTabs({ activeTab, onTabChange, hasNotes, hasAttachments, hasEvaluations }: DetailPageTabsProps) {
  const tabs = useMemo(() => {
    const result: { key: DetailTab; label: string }[] = [
      { key: 'overview', label: 'Overview' },
    ];
    if (hasNotes) {
      result.push({ key: 'notes', label: 'Notes' });
    }
    if (hasAttachments) {
      result.push({ key: 'attachments', label: 'Attachments' });
    }
    if (hasEvaluations) {
      result.push({ key: 'evaluations', label: 'Evaluations' });
    }
    result.push({ key: 'audit-trail', label: 'Audit Trail' });
    return result;
  }, [hasNotes, hasAttachments, hasEvaluations]);

  return (
    <div className="border-b mb-6">
      <nav className="flex gap-0 -mb-px">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30',
            )}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
