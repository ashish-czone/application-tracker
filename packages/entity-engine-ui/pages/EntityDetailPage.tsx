import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Settings, Copy, Trash2, MoreHorizontal, Briefcase, UserPlus } from 'lucide-react';
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
import { DynamicSection } from '@packages/eav-attributes-ui';
import { useEntityEngine, useEntityHooks, useEntityConfig } from '../EntityEngineProvider';
import { useEntityLayout } from '../helpers/useEntityLayout';
import { useListLayout } from '../helpers/useListLayout';
import { EntityRelatedList } from './EntityRelatedList';
import { EntityPickerPanel } from '../components/EntityPickerPanel';
import { DetailPageTabs, type DetailTab } from '../components/DetailPageTabs';
import { DetailPageSidebar } from '../components/DetailPageSidebar';

interface EntityDetailPageProps {
  entityType: string;
  /** Render the audit trail tab content. Receives entityType and entityId. */
  renderAuditTrail?: (entityType: string, entityId: string) => React.ReactNode;
  /** Render the pipeline progress bar. Receives entityType, entityId, and the full entity record. */
  renderPipelineProgress?: (entityType: string, entityId: string, entity: Record<string, unknown>) => React.ReactNode;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Copy, Trash2, Briefcase, UserPlus,
};

/**
 * Generic detail page for any entity registered with the entity engine.
 * Layout: left sidebar (related records) + main area (tabs: Overview | Audit Trail).
 */
export function EntityDetailPage({ entityType, renderAuditTrail, renderPipelineProgress }: EntityDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const entity = useEntityConfig(entityType);
  const hooks = useEntityHooks(entityType);
  const { getDetailPlugins, apiFn } = useEntityEngine();
  const queryClient = useQueryClient();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [activePicker, setActivePicker] = useState<EntityAction | null>(null);
  const [browseRelationship, setBrowseRelationship] = useState<{
    name: string;
    label: string;
    targetEntity: string;
    foreignKey?: string;
  } | null>(null);

  const { data: item, isLoading, isError } = hooks.useDetail(id ?? null);
  const { data: layout, isLoading: layoutLoading } = useEntityLayout(entityType);
  const { data: listLayout } = useListLayout(entityType);
  const updateMutation = hooks.useUpdate();
  const createMutation = hooks.useCreate();
  const deleteMutation = hooks.useDelete({
    onSuccess: () => navigate(`/${entity.slug}`),
  });

  // Search callbacks for user and lookup fields
  const searchUsers = useCallback(async (query: string) => {
    const res = await apiFn.get<{ data: { id: string; firstName: string; lastName: string }[] }>(`/users?search=${encodeURIComponent(query)}&limit=20`);
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

  const getFieldSearchForSection = useCallback((fieldKey: string, fieldType: string) => {
    if (fieldType === 'user') return searchUsers;
    if (!layout) return undefined;
    for (const section of layout.sections) {
      const field = section.fields.find(f => f.fieldKey === fieldKey);
      if (field?.lookupEntity) return (query: string) => searchLookup(field.lookupEntity!, query);
    }
    return undefined;
  }, [searchUsers, searchLookup, layout]);

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

  const getDisplayName = (row: Record<string, unknown>): string => {
    const { nameField } = entity.ui;
    if (Array.isArray(nameField)) {
      return nameField.map((f) => row[f] ?? '').filter(Boolean).join(' ');
    }
    return String(row[nameField] ?? '');
  };

  const getSubtitle = (row: Record<string, unknown>): string | null => {
    if (!entity.ui.subtitleField) return null;
    const val = row[entity.ui.subtitleField];
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
          const { id: _id, createdAt: _ca, updatedAt: _ua, deletedAt: _da, deletedBy: _db, createdBy: _cb, ...cloneData } = item;
          const created = await createMutation.mutateAsync(cloneData);
          toast.success(`${entity.singularName} cloned`);
          navigate(`/${entity.slug}/${(created as any).id}`);
        } catch {
          toast.error(`Failed to clone ${entity.singularName.toLowerCase()}`);
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

  return (
    <div>
      {/* Header */}
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

          <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* Tabs */}
      <DetailPageTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Content area: Sidebar + Main */}
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
            <div className="space-y-4">
              {/* Pipeline progress bar for entities with workflow fields */}
              {renderPipelineProgress && entity.features.hasWorkflow && (
                renderPipelineProgress(entityType, item.id as string, item)
              )}

              {layout?.sections
                .filter((s) => s.fields.length > 0)
                .map((section) => (
                  <DynamicSection
                    key={section.id}
                    section={section}
                    values={item}
                    onSave={async (values) => {
                      await updateMutation.mutateAsync({ id: item.id as string, data: values });
                    }}
                    isSaving={updateMutation.isPending}
                    getFieldSearch={getFieldSearchForSection}
                    getChipSearch={getChipSearchForSection}
                  />
                ))}

              {plugins.map((plugin) => (
                <plugin.component key={plugin.label} entity={item} />
              ))}
            </div>
          )}

          {activeTab === 'audit-trail' && renderAuditTrail && (
            renderAuditTrail(entityType, item.id as string)
          )}
        </div>
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
