import { cn } from '@packages/ui';

interface TabDef {
  key: string;
  label: string;
}

interface DetailPageTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  tabs: TabDef[];
}

export function DetailPageTabs({ activeTab, onTabChange, tabs }: DetailPageTabsProps) {
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
