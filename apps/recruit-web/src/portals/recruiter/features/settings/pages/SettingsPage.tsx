import { lazy, Suspense, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@packages/ui';
import { useEntityEngine, useEntityConfig } from '@packages/entity-engine-ui';
import { useWorkflows, PipelineStageManager } from '@packages/platform-ui/workflows';

const FieldManagementPage = lazy(
  () => import('../../field-management/pages/FieldManagementPage'),
);

function EntitySettingsContent({ entityType }: { entityType: string }) {
  const entity = useEntityConfig(entityType);
  const { data: workflows } = useWorkflows();
  const [subTab, setSubTab] = useState<'fields' | 'pipeline'>('fields');

  const entityWorkflow = useMemo(
    () => workflows?.find((w) => w.entityType === entityType && w.isActive),
    [workflows, entityType],
  );

  const hasWorkflow = entity.features.hasWorkflow && !!entityWorkflow;

  return (
    <div>
      {/* Sub-tabs: Fields | Pipeline */}
      {hasWorkflow && (
        <div className="flex gap-4 mb-5">
          <button
            type="button"
            onClick={() => setSubTab('fields')}
            className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
              subTab === 'fields'
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Fields & Layout
          </button>
          <button
            type="button"
            onClick={() => setSubTab('pipeline')}
            className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
              subTab === 'pipeline'
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Pipeline
          </button>
        </div>
      )}

      {subTab === 'fields' && (
        <Suspense
          fallback={
            <div className="space-y-4">
              <div className="h-6 w-48 animate-pulse rounded bg-muted" />
              <div className="h-64 animate-pulse rounded bg-muted" />
            </div>
          }
        >
          <FieldManagementPage entityType={entityType} />
        </Suspense>
      )}

      {subTab === 'pipeline' && entityWorkflow && (
        <PipelineStageManager workflowSlug={entityWorkflow.slug} />
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { entityType: paramEntityType } = useParams<{ entityType: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { entities } = useEntityEngine();

  const entityTabs = useMemo(
    () =>
      [...entities]
        .sort((a, b) => (a.ui.navOrder ?? 99) - (b.ui.navOrder ?? 99))
        .map((e) => ({ key: e.entityType, label: e.pluralName, slug: e.slug })),
    [entities],
  );

  const activeTab = paramEntityType ?? entityTabs[0]?.key ?? '';

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
          <p className="text-sm text-muted-foreground">Manage entity fields, layouts, and pipelines</p>
        </div>
      </div>

      {/* Entity tabs */}
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

      {/* Entity content with sub-tabs */}
      <EntitySettingsContent key={activeTab} entityType={activeTab} />
    </div>
  );
}
