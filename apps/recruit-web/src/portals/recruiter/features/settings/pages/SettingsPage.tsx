import { lazy, Suspense, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button, Badge } from '@packages/ui';
import { useEntityEngine, useEntityConfig } from '@packages/entity-engine-ui';
import { useWorkflows, useCreateWorkflow, PipelineStageManager } from '@packages/platform-ui/workflows';

const FieldManagementPage = lazy(
  () => import('../../field-management/pages/FieldManagementPage'),
);

function EntitySettingsContent({ entityType, initialSubTab }: { entityType: string; initialSubTab?: string }) {
  const entity = useEntityConfig(entityType);
  const { data: workflows } = useWorkflows();
  const createWorkflow = useCreateWorkflow();
  const [subTab, setSubTab] = useState<'fields' | 'pipeline'>(initialSubTab === 'pipeline' ? 'pipeline' : 'fields');

  const entityWorkflows = useMemo(
    () => (workflows ?? []).filter((w) => w.entityType === entityType && w.isActive),
    [workflows, entityType],
  );

  const hasWorkflow = entity.features.hasWorkflow && entityWorkflows.length > 0;
  const discriminator = entity.features.workflowDiscriminator;

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const activeWorkflow = selectedSlug
    ? entityWorkflows.find((w) => w.slug === selectedSlug) ?? entityWorkflows[0]
    : entityWorkflows[0];

  function handleCreatePipeline(discriminatorValue: string) {
    if (!activeWorkflow || !discriminator) return;
    const option = discriminator.options.find((o) => o.value === discriminatorValue);
    const slug = `${activeWorkflow.slug}-${discriminatorValue.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    createWorkflow.mutate({
      slug,
      name: `${option?.label ?? discriminatorValue} Pipeline`,
      entityType,
      fieldName: discriminator.fieldName,
      initialState: activeWorkflow.initialState,
      discriminatorKey: discriminator.key,
      discriminatorValue,
      isDefault: false,
    });
  }

  // Discriminator values already used by existing pipelines
  const usedDiscriminatorValues = useMemo(
    () => new Set(entityWorkflows.map((w) => w.discriminatorValue).filter(Boolean)),
    [entityWorkflows],
  );

  const availableDiscriminatorOptions = useMemo(
    () => discriminator?.options.filter((o) => !usedDiscriminatorValues.has(o.value)) ?? [],
    [discriminator, usedDiscriminatorValues],
  );

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

      {subTab === 'pipeline' && activeWorkflow && (
        <div>
          {/* Multi-pipeline selector — only if discriminator is configured */}
          {discriminator && entityWorkflows.length > 0 && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {entityWorkflows.map((w) => (
                <button
                  key={w.slug}
                  type="button"
                  onClick={() => setSelectedSlug(w.slug)}
                  className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                    (activeWorkflow.slug === w.slug)
                      ? 'border-primary bg-primary/5 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                  }`}
                >
                  {w.name}
                  {w.isDefault && (
                    <Badge variant="outline" className="ml-1.5 text-[10px] px-1 py-0">Default</Badge>
                  )}
                  {w.discriminatorValue && (
                    <Badge variant="secondary" className="ml-1.5 text-[10px] px-1 py-0">{w.discriminatorValue}</Badge>
                  )}
                </button>
              ))}

              {/* Add pipeline for new discriminator value */}
              {availableDiscriminatorOptions.length > 0 && (
                <select
                  onChange={(e) => {
                    if (e.target.value) handleCreatePipeline(e.target.value);
                    e.target.value = '';
                  }}
                  className="h-8 px-2 text-xs rounded-md border border-dashed border-border bg-transparent text-muted-foreground"
                  defaultValue=""
                  disabled={createWorkflow.isPending}
                >
                  <option value="" disabled>+ Add pipeline for {discriminator.label}...</option>
                  {availableDiscriminatorOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <PipelineStageManager workflowSlug={activeWorkflow.slug} />
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { entityType: paramEntityType } = useParams<{ entityType: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { entities } = useEntityEngine();

  const tabParam = searchParams.get('tab');

  const entityTabs = useMemo(
    () =>
      [...entities]
        .sort((a, b) => (a.ui.navOrder ?? 99) - (b.ui.navOrder ?? 99))
        .map((e) => ({ key: e.entityType, label: e.pluralName, slug: e.slug, hasWorkflow: e.features.hasWorkflow })),
    [entities],
  );

  const defaultTab = useMemo(() => {
    if (tabParam === 'pipeline') {
      return entityTabs.find((t) => t.hasWorkflow)?.key ?? entityTabs[0]?.key ?? '';
    }
    return entityTabs[0]?.key ?? '';
  }, [tabParam, entityTabs]);

  const activeTab = paramEntityType ?? defaultTab;

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
      <EntitySettingsContent key={activeTab} entityType={activeTab} initialSubTab={tabParam ?? undefined} />
    </div>
  );
}
