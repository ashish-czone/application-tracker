import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Settings, Copy, Trash2, MoreHorizontal, Briefcase, UserPlus, ChevronDown } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  toast,
} from '@packages/ui';
import type { EntityAction } from '@packages/entity-engine';
import type { DetailTabPlugin } from '../types';
import { DynamicSection, isFieldEmpty } from '@packages/eav-attributes-ui';
import { useEntityEngine, useEntityHooks, useEntityConfig } from '../EntityEngineProvider';
import { useEntityLayout } from '../helpers/useEntityLayout';
import { useListLayout } from '../helpers/useListLayout';
import { EntityRelatedList } from './EntityRelatedList';
import { EntityPickerPanel } from '../components/EntityPickerPanel';
import { DetailPageTabs } from '../components/DetailPageTabs';
import { DetailPageSidebar } from '../components/DetailPageSidebar';

interface EntityDetailPageProps {
  entityType: string;
  /** Render the pipeline progress bar. Receives entityType, entityId, and the full entity record. */
  renderPipelineProgress?: (entityType: string, entityId: string, entity: Record<string, unknown>) => React.ReactNode;
  /** Render workflow transition actions in the header. Receives entityType, entityId, and the full entity record. */
  renderWorkflowActions?: (entityType: string, entityId: string, entity: Record<string, unknown>) => React.ReactNode;
  /** Render additional action buttons in the header (before workflow actions). */
  renderHeaderActions?: (entityType: string, entityId: string, entity: Record<string, unknown>) => React.ReactNode;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Copy, Trash2, Briefcase, UserPlus,
};

/**
 * Generic detail page for any entity registered with the entity engine.
 * Layout: left sidebar (related records) + main area (tabs: Overview | Audit Trail).
 */
export function EntityDetailPage({ entityType, renderPipelineProgress, renderWorkflowActions, renderHeaderActions }: EntityDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const entity = useEntityConfig(entityType);
  const hooks = useEntityHooks(entityType);
  const { getDetailPlugins, getDetailTabs, getRightSidebarPanels, getHeaderPlugins, apiFn } = useEntityEngine();
  const queryClient = useQueryClient();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [activePicker, setActivePicker] = useState<EntityAction | null>(null);
  const [browseRelationship, setBrowseRelationship] = useState<{
    name: string;
    label: string;
    targetEntity: string;
    foreignKey?: string;
  } | null>(null);

  // Collapsing header: observe a sentinel element at the top of the page
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setHeaderCollapsed(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const { data: item, isLoading, isError } = hooks.useDetail(id ?? null);
  const { data: layout, isLoading: layoutLoading } = useEntityLayout(entityType);
  const { data: listLayout } = useListLayout(entityType);
  const updateMutation = hooks.useUpdate();
  const cloneMutation = hooks.useClone();
  const deleteMutation = hooks.useDelete({
    onSuccess: () => navigate(`/${entity.slug}`),
  });

  // Search callbacks for user and lookup fields
  const searchUsers = useCallback(async (query: string) => {
    const res = await apiFn.get<{ data: { id: string; firstName: string; lastName: string }[] }>(`/users?search=${encodeURIComponent(query)}&limit=20&sort=firstName&order=asc`);
    return res.data.map((u) => ({ label: `${u.firstName} ${u.lastName}`.trim(), value: u.id }));
  }, [apiFn]);

  const searchLookup = useCallback(async (entity: string, query: string) => {
    return apiFn.get<{ label: string; value: string }[]>(`/lookups/${entity}?search=${encodeURIComponent(query)}&limit=20`);
  }, [apiFn]);

  const searchTags = useCallback(async (groupSlug: string, query: string) => {
    return apiFn.get<{ label: string; value: string; color?: string }[]>(
      `/tags/group/${groupSlug}?search=${encodeURIComponent(query)}&limit=20`,
    );
  }, [apiFn]);

  // Cache: category group slug → group ID
  const categoryGroupCache = useMemo(() => new Map<string, string>(), []);

  const searchCategories = useCallback(async (groupSlug: string, query: string) => {
    let groupId = categoryGroupCache.get(groupSlug);
    if (!groupId) {
      const groups = await apiFn.get<{ id: string; slug: string }[]>('/category-groups');
      for (const g of groups) categoryGroupCache.set(g.slug, g.id);
      groupId = categoryGroupCache.get(groupSlug);
    }
    if (!groupId) return [];
    const tree = await apiFn.get<{ id: string; name: string }[]>(`/category-groups/${groupId}/tree`);
    const lowerQuery = query.toLowerCase();
    return tree
      .filter(c => c.name.toLowerCase().includes(lowerQuery))
      .map(c => ({ label: c.name, value: c.id }));
  }, [apiFn, categoryGroupCache]);

  const getFieldSearchForSection = useCallback((fieldKey: string, fieldType: string) => {
    if (fieldType === 'user') return searchUsers;
    if (!layout) return undefined;
    for (const section of layout.sections) {
      const field = section.fields.find(f => f.fieldKey === fieldKey);
      if (field?.lookupEntity) return (query: string) => searchLookup(field.lookupEntity!, query);
      if (fieldType === 'category' && field?.categoryGroupSlug) {
        return (query: string) => searchCategories(field.categoryGroupSlug!, query);
      }
    }
    return undefined;
  }, [searchUsers, searchLookup, searchCategories, layout]);

  const getChipSearchForSection = useCallback((fieldKey: string, fieldType: string) => {
    if (fieldType === 'multi_user') return searchUsers;
    if (fieldType === 'tags' && layout) {
      for (const section of layout.sections) {
        const field = section.fields.find(f => f.fieldKey === fieldKey);
        if (field?.tagGroupSlug) {
          return (query: string) => searchTags(field.tagGroupSlug!, query);
        }
      }
    }
    return undefined;
  }, [searchUsers, searchTags, layout]);

  const hasManyRelationships = useMemo(
    () => entity.relationships.filter((r) => r.type === 'hasMany'),
    [entity.relationships],
  );

  const relationshipCounts = useMemo(() => {
    if (!item) return {};
    const counts: Record<string, number> = {};
    for (const rel of hasManyRelationships) {
      const key = `${rel.name}Count`;
      counts[key] = typeof item[key] === 'number' ? (item[key] as number) : 0;
    }
    return counts;
  }, [item, hasManyRelationships]);

  const detailActions = listLayout?.actions?.detail ?? [];

  // Split actions: first picker action as primary button, rest in dropdown
  const primaryAction = detailActions.find((a) => a.picker);
  const dropdownActions = detailActions.filter((a) => a !== primaryAction);

  // Build visible tabs: Overview (built-in) + registered tab plugins filtered by enabledFor
  // Must be above early returns to satisfy Rules of Hooks
  const visibleTabs = useMemo(() => {
    const registeredTabs = getDetailTabs(entityType);
    const filtered = registeredTabs.filter((tab) => tab.enabledFor?.(entity) ?? true);
    return [{ key: 'overview', label: 'Overview', order: 0 } as DetailTabPlugin, ...filtered];
  }, [getDetailTabs, entityType, entity]);

  const getDisplayName = (row: Record<string, unknown>): string => {
    const { nameField } = entity;
    const resolve = (f: string) => row[`${f}__label`] ?? row[f] ?? '';
    if (Array.isArray(nameField)) {
      return nameField.map(resolve).filter(Boolean).join(' — ');
    }
    return String(resolve(nameField) || row.id || '');
  };

  const getSubtitle = (row: Record<string, unknown>): string | null => {
    if (!entity.subtitleField) return null;
    const val = row[entity.subtitleField];
    return val ? String(val) : null;
  };

  const handleAction = async (action: EntityAction) => {
    if (!item) return;

    switch (action.key) {
      case 'delete':
        setShowDeleteConfirm(true);
        break;
      case 'clone': {
        try {
          const created = await cloneMutation.mutateAsync(item.id as string);
          navigate(`/${entity.slug}/${(created as any).id}`);
        } catch {
          // Error handled by useClone hook toast
        }
        break;
      }
      default:
        if (action.picker) {
          setActivePicker(action);
        }
        break;
    }
  };

  if (isLoading || layoutLoading) {
    return (
      <div className="space-y-4 p-1">
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (isError || !item) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{entity.singularName} not found</p>
        <Link to={`/${entity.slug}`} className="text-sm text-primary hover:underline mt-2 inline-block">
          Back to {entity.pluralName.toLowerCase()}
        </Link>
      </div>
    );
  }

  const displayName = getDisplayName(item);
  const subtitle = getSubtitle(item);
  const plugins = getDetailPlugins(entityType).sort((a, b) => a.order - b.order);

  // Right sidebar panels — filtered by enabledFor
  const sidebarPanels = getRightSidebarPanels(entityType).filter(
    (panel) => panel.enabledFor?.(entity) ?? true,
  );

  // Header plugins — rendered between the title block and the tabs
  const headerPlugins = getHeaderPlugins(entityType).filter(
    (plugin) => plugin.enabledFor?.(entity) ?? true,
  );

  const headerActions = (
    <div className="flex items-center gap-2">
      {/* Custom header actions */}
      {renderHeaderActions && renderHeaderActions(entityType, item.id as string, item)}

      {/* Workflow transition actions — renderer self-gates and returns null when no workflow is bound. */}
      {renderWorkflowActions && renderWorkflowActions(entityType, item.id as string, item)}

      {/* Primary action button (first picker action) */}
      {primaryAction && (
        <Button size="sm" onClick={() => handleAction(primaryAction)}>
          {primaryAction.icon && ICON_MAP[primaryAction.icon] && (
            (() => {
              const Icon = ICON_MAP[primaryAction.icon!];
              return <Icon className="h-4 w-4 mr-1" />;
            })()
          )}
          {primaryAction.label}
        </Button>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(`/settings/${entityType}`, { state: { from: location.pathname } })}
      >
        <Settings className="h-4 w-4 mr-1" />
        Edit Layout
      </Button>

      {/* More actions dropdown */}
      {dropdownActions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {dropdownActions.map((action, idx) => {
              const Icon = action.icon ? ICON_MAP[action.icon] : null;
              const isDestructive = action.variant === 'destructive';

              return (
                <div key={action.key}>
                  {isDestructive && idx > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    onClick={() => handleAction(action)}
                    className={isDestructive ? 'text-destructive focus:text-destructive' : ''}
                  >
                    {Icon && <Icon className="h-4 w-4 mr-2" />}
                    {action.label}
                  </DropdownMenuItem>
                </div>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );

  return (
    <div>
      {/* Scroll sentinel — when this scrolls out of view, header collapses */}
      <div ref={sentinelRef} className="h-0" />

      {/* Collapsed sticky header — appears when scrolled past the full header */}
      {headerCollapsed && (
        <div className="sticky top-0 z-20 -mx-6 px-6 py-2.5 bg-background/95 backdrop-blur-sm border-b border-border shadow-sm animate-in slide-in-from-top-1 duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                to={`/${entity.slug}`}
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <h2 className="text-sm font-semibold text-foreground truncate">{displayName}</h2>
            </div>
            {headerActions}
          </div>
        </div>
      )}

      {/* Full header */}
      <div className="mb-6">
        <Link
          to={`/${entity.slug}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          {entity.pluralName}
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{displayName}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          {headerActions}
        </div>

        {headerPlugins.length > 0 && (
          <div className="mt-3 space-y-3">
            {headerPlugins.map((plugin) => (
              <plugin.component
                key={plugin.key}
                entityType={entityType}
                entityId={item.id as string}
                entity={item}
              />
            ))}
          </div>
        )}
      </div>

      {/* System metadata */}
      <p className="text-xs text-muted-foreground mb-4">
        {item.createdBy__label ? <>Created by {item.createdBy__label as string}</> : null}
        {item.createdAt ? <>{item.createdBy__label ? ' · ' : ''}{new Date(item.createdAt as string).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</> : null}
        {item.updatedAt && item.updatedAt !== item.createdAt ? <> · Updated {new Date(item.updatedAt as string).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</> : null}
      </p>

      {/* Tabs */}
      <DetailPageTabs activeTab={activeTab} onTabChange={setActiveTab} tabs={visibleTabs} />

      {/* Content area: Sidebar + Main + Right Sidebar */}
      <div className="flex gap-6">
        {/* Left sidebar — related record launchers */}
        {hasManyRelationships.length > 0 && (
          <DetailPageSidebar
            relationships={hasManyRelationships}
            counts={relationshipCounts}
            onRelationshipClick={(rel) => setBrowseRelationship(rel)}
          />
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {activeTab === 'overview' && (
            <OverviewTab
              layout={layout}
              item={item}
              entityType={entityType}
              entity={entity}
              plugins={plugins}
              updateMutation={updateMutation}
              renderPipelineProgress={renderPipelineProgress}
              getFieldSearch={getFieldSearchForSection}
              getChipSearch={getChipSearchForSection}
            />
          )}

          {activeTab !== 'overview' && (() => {
            const tab = visibleTabs.find(t => t.key === activeTab);
            if (!tab?.component) return null;
            const TabComponent = tab.component;
            return <TabComponent entityType={entityType} entityId={item.id as string} />;
          })()}
        </div>

        {/* Right sidebar — contextual panels (notes, files, evaluations, etc.) */}
        {sidebarPanels.length > 0 && (
          <div className="w-80 shrink-0 space-y-3">
            {sidebarPanels.map((panel) => (
              <CollapsiblePanel
                key={panel.key}
                label={panel.label}
                defaultCollapsed={panel.defaultCollapsed}
              >
                <panel.component entityType={entityType} entityId={item.id as string} />
              </CollapsiblePanel>
            ))}
          </div>
        )}
      </div>

      {/* Related records browse panel */}
      <Sheet
        open={!!browseRelationship}
        onOpenChange={(open) => { if (!open) setBrowseRelationship(null); }}
      >
        <SheetContent className="w-3/4 max-w-3xl overflow-y-auto">
          {browseRelationship && (
            <>
              <SheetHeader>
                <SheetTitle>{browseRelationship.label}</SheetTitle>
                <SheetDescription>
                  Related {browseRelationship.label.toLowerCase()} for this {entity.singularName.toLowerCase()}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4">
                <EntityRelatedList
                  targetEntityType={browseRelationship.targetEntity}
                  foreignKey={browseRelationship.foreignKey ?? `${entityType}Id`}
                  parentId={item.id as string}
                  label={browseRelationship.label}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={`Delete ${entity.singularName.toLowerCase()}`}
        description={`This will delete "${displayName}".`}
        confirmLabel={`Delete ${entity.singularName.toLowerCase()}`}
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(item.id as string)}
      />

      {/* Entity picker panel for association actions */}
      {activePicker?.picker && (
        <EntityPickerPanel
          mode="picker"
          open={!!activePicker}
          onOpenChange={(open) => { if (!open) setActivePicker(null); }}
          entityType={activePicker.picker.entityType}
          pickerConfig={activePicker.picker}
          sourceId={item.id as string}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: [entityType] });
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible panel for right sidebar
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Overview tab with smart empty-field/section handling
// ---------------------------------------------------------------------------

function OverviewTab({
  layout,
  item,
  entityType,
  entity,
  plugins,
  updateMutation,
  renderPipelineProgress,
  getFieldSearch,
  getChipSearch,
}: {
  layout: any;
  item: Record<string, unknown>;
  entityType: string;
  entity: any;
  plugins: any[];
  updateMutation: any;
  renderPipelineProgress?: (entityType: string, entityId: string, entity: Record<string, unknown>) => React.ReactNode;
  getFieldSearch: any;
  getChipSearch: any;
}) {
  const [showEmptySections, setShowEmptySections] = useState(false);

  const allSections = useMemo(
    () =>
      (layout?.sections ?? []).filter(
        (s: any) => s.fields.length > 0 && s.id !== '__unassigned__',
      ),
    [layout],
  );

  const { populated, empty } = useMemo(() => {
    const populated: any[] = [];
    const empty: any[] = [];
    for (const section of allSections) {
      const hasAnyValue = section.fields.some((f: any) => !isFieldEmpty(item[f.fieldKey]));
      if (hasAnyValue) populated.push(section);
      else empty.push(section);
    }
    return { populated, empty };
  }, [allSections, item]);

  const sectionsToRender = showEmptySections ? allSections : populated;

  return (
    <div className="space-y-4">
      {renderPipelineProgress && renderPipelineProgress(entityType, item.id as string, item)}

      {sectionsToRender.map((section: any) => (
        <DynamicSection
          key={section.id}
          section={section}
          values={item}
          onSave={async (values: Record<string, unknown>) => {
            await updateMutation.mutateAsync({ id: item.id as string, data: values });
          }}
          isSaving={updateMutation.isPending}
          getFieldSearch={getFieldSearch}
          getChipSearch={getChipSearch}
          showEmptyFields={showEmptySections}
        />
      ))}

      {plugins.map((plugin: any) => (
        <plugin.component key={plugin.label} entity={item} />
      ))}

      {!showEmptySections && empty.length > 0 && (
        <button
          type="button"
          onClick={() => setShowEmptySections(true)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Show {empty.length} empty {empty.length === 1 ? 'section' : 'sections'}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible panel for right sidebar
// ---------------------------------------------------------------------------

function CollapsiblePanel({
  label,
  defaultCollapsed = false,
  children,
}: {
  label: string;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between w-full px-3 py-2.5 text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors"
      >
        {label}
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${collapsed ? '-rotate-90' : ''}`}
        />
      </button>
      {!collapsed && (
        <div className="px-3 pb-3 max-h-[400px] overflow-y-auto">
          {children}
        </div>
      )}
    </div>
  );
}
