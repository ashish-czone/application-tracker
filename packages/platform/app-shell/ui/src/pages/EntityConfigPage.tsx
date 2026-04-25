import { lazy, Suspense, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@packages/ui';
import { useEntityEngine, useEntityConfig } from '@packages/entity-engine-ui';
import type { EntityConfigTab } from '@packages/domains';

const FieldManagementPage = lazy(
  () => import('@packages/entity-layout-ui').then((m) => ({ default: m.FieldManagementPage })),
);

const FIELDS_TAB_KEY = 'fields';

function EntitySettingsContent({
  entityType,
  initialSubTab,
  featureTabs,
}: {
  entityType: string;
  initialSubTab?: string;
  featureTabs: EntityConfigTab[];
}) {
  const entity = useEntityConfig(entityType);

  const applicableFeatureTabs = useMemo(
    () => featureTabs.filter((t) => t.appliesTo(entity)),
    [featureTabs, entity],
  );

  const [subTab, setSubTab] = useState<string>(() => {
    if (initialSubTab && applicableFeatureTabs.some((t) => t.key === initialSubTab)) {
      return initialSubTab;
    }
    return FIELDS_TAB_KEY;
  });

  const showStrip = applicableFeatureTabs.length > 0;
  const ActiveFeatureTab = applicableFeatureTabs.find((t) => t.key === subTab)?.component;

  return (
    <div>
      {showStrip && (
        <div className="flex gap-4 mb-5">
          <button
            type="button"
            onClick={() => setSubTab(FIELDS_TAB_KEY)}
            className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
              subTab === FIELDS_TAB_KEY
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Fields & Layout
          </button>
          {applicableFeatureTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSubTab(tab.key)}
              className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
                subTab === tab.key
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {subTab === FIELDS_TAB_KEY && (
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

      {ActiveFeatureTab && subTab !== FIELDS_TAB_KEY && (
        <ActiveFeatureTab entityType={entityType} />
      )}
    </div>
  );
}

interface EntityConfigPageProps {
  /** Sub-tabs contributed by features. Empty array if none registered. */
  entityConfigTabs?: EntityConfigTab[];
}

export function EntityConfigPage({ entityConfigTabs = [] }: EntityConfigPageProps) {
  const { entityType: paramEntityType } = useParams<{ entityType: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { entities } = useEntityEngine();

  const tabParam = searchParams.get('tab');

  const entityTabs = useMemo(
    () =>
      [...entities]
        .filter((e) => e.features.adminConfigurable)
        .sort((a, b) => (a.ui.navOrder ?? 99) - (b.ui.navOrder ?? 99))
        .map((e) => ({ key: e.entityType, label: e.pluralName, slug: e.slug, entity: e })),
    [entities],
  );

  // If the URL carries `?tab=<featureTabKey>`, preferentially open the
  // first entity that has that feature tab applicable. Falls back to the
  // first entity tab. Same posture as the old hard-coded `?tab=pipeline`
  // behavior, generalized over feature tabs.
  const defaultTab = useMemo(() => {
    if (tabParam) {
      const featureTab = entityConfigTabs.find((t) => t.key === tabParam);
      if (featureTab) {
        const match = entityTabs.find((t) => featureTab.appliesTo(t.entity));
        if (match) return match.key;
      }
    }
    return entityTabs[0]?.key ?? '';
  }, [tabParam, entityTabs, entityConfigTabs]);

  // Fall back to default when the URL points at an entity that isn't
  // admin-configurable (or is unknown) — we never render the config UI for those.
  const activeTab =
    paramEntityType && entityTabs.some((t) => t.key === paramEntityType)
      ? paramEntityType
      : defaultTab;

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
          <h1 className="text-lg font-semibold text-foreground">Entity Config</h1>
          <p className="text-sm text-muted-foreground">Manage entity fields, layouts, and pipelines</p>
        </div>
      </div>

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

      <EntitySettingsContent
        key={activeTab}
        entityType={activeTab}
        initialSubTab={tabParam ?? undefined}
        featureTabs={entityConfigTabs}
      />
    </div>
  );
}
