import { useState } from 'react';
import { AutomationsListPage } from './AutomationsListPage';
import { TemplatesListPage } from './TemplatesListPage';

const TABS = [
  { id: 'rules', label: 'Rules' },
  { id: 'templates', label: 'Templates' },
] as const;

type TabId = typeof TABS[number]['id'];

export function AutomationsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('rules');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Automations</h1>
        <p className="text-sm text-muted-foreground">
          Configure notification rules and templates
        </p>
      </div>

      <div className="border-b border-border mb-6">
        <nav className="flex gap-6" aria-label="Tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`pb-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'rules' && <AutomationsListPage />}
      {activeTab === 'templates' && <TemplatesListPage />}
    </div>
  );
}
