import { useState } from 'react';
import { lazy, Suspense } from 'react';

const FieldManagementPage = lazy(
  () => import('../../field-management/pages/FieldManagementPage'),
);

// Entity types that have EAV field management
const ENTITY_TABS = [
  { key: 'candidates', label: 'Candidates' },
] as const;

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<string>(ENTITY_TABS[0].key);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage entity fields and layouts</p>
      </div>

      {/* Tabs */}
      <div className="border-b mb-6">
        <nav className="flex gap-0 -mb-px">
          {ENTITY_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="h-6 w-48 animate-pulse rounded bg-muted" />
            <div className="h-64 animate-pulse rounded bg-muted" />
          </div>
        }
      >
        <FieldManagementPage entityType={activeTab} />
      </Suspense>
    </div>
  );
}
