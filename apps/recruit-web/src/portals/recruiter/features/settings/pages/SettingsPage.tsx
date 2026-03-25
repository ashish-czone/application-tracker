import { lazy, Suspense, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@packages/ui';
import { useEntityEngine } from '@packages/entity-engine-ui';

const FieldManagementPage = lazy(
  () => import('../../field-management/pages/FieldManagementPage'),
);

export default function SettingsPage() {
  const { entityType: paramEntityType } = useParams<{ entityType: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { entities } = useEntityEngine();

  // Sort entities by nav order for consistent tab ordering
  const entityTabs = useMemo(
    () =>
      [...entities]
        .sort((a, b) => (a.ui.navOrder ?? 99) - (b.ui.navOrder ?? 99))
        .map((e) => ({ key: e.entityType, label: e.pluralName, slug: e.slug })),
    [entities],
  );

  const activeTab = paramEntityType ?? entityTabs[0]?.key ?? '';

  // Check if we came from a detail page (location.state.from)
  const cameFrom = (location.state as { from?: string } | null)?.from;

  if (entityTabs.length === 0) {
    return (
      <div className="space-y-4 p-1">
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        {cameFrom && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(cameFrom)}
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <h1 className="text-lg font-semibold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage entity fields and layouts</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b mb-6">
        <nav className="flex gap-0 -mb-px">
          {entityTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => navigate(`/settings/${tab.key}`, { replace: true, state: location.state })}
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
