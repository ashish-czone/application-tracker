import { useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Settings, Copy, Trash2, MoreHorizontal, Briefcase, UserPlus } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  toast,
} from '@packages/ui';
import type { EntityAction } from '@packages/entity-engine';
import { DynamicSection } from '@packages/eav-attributes-ui';
import { useEntityEngine, useEntityHooks, useEntityConfig } from '../EntityEngineProvider';
import { useEntityLayout } from '../helpers/useEntityLayout';
import { useListLayout } from '../helpers/useListLayout';
import { EntityRelatedList } from './EntityRelatedList';
import { EntityPickerPanel } from '../components/EntityPickerPanel';

interface EntityDetailPageProps {
  entityType: string;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Copy, Trash2, Briefcase, UserPlus,
};

/**
 * Generic detail page for any entity registered with the entity engine.
 * Renders a header with entity name, layout-driven editable sections,
 * and plugin sections (skills, resume, etc.) from the entity UI config.
 */
export function EntityDetailPage({ entityType }: EntityDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const entity = useEntityConfig(entityType);
  const hooks = useEntityHooks(entityType);
  const { getDetailPlugins, apiFn } = useEntityEngine();
  const queryClient = useQueryClient();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState('detail');
  const [activePicker, setActivePicker] = useState<EntityAction | null>(null);

  const { data: item, isLoading, isError } = hooks.useDetail(id ?? null);
  const { data: layout, isLoading: layoutLoading } = useEntityLayout(entityType);
  const { data: listLayout } = useListLayout(entityType);
  const updateMutation = hooks.useUpdate();
  const createMutation = hooks.useCreate();
  const deleteMutation = hooks.useDelete({
    onSuccess: () => navigate(`/${entity.slug}`),
  });

  // Check if any fields need user options
  const hasUserFields = useMemo(() => {
    if (!layout) return false;
    return layout.sections.some(s => s.fields.some(f => f.fieldType === 'user' || f.fieldType === 'multi_user'));
  }, [layout]);

  const { data: userOptions } = useQuery({
    queryKey: ['user-options'],
    queryFn: async () => {
      const res = await apiFn.get<{ data: { id: string; firstName: string; lastName: string }[] }>('/users?limit=200');
      return res.data.map((u) => ({ label: `${u.firstName} ${u.lastName}`.trim(), value: u.id }));
    },
    enabled: hasUserFields,
  });

  // Build per-field lookup/chip options maps for DynamicSection edit mode
  const fieldLookupOptions = useMemo(() => {
    if (!userOptions) return undefined;
    const map: Record<string, { label: string; value: string }[]> = {};
    if (!layout) return map;
    for (const section of layout.sections) {
      for (const field of section.fields) {
        if (field.fieldType === 'user') map[field.fieldKey] = userOptions;
      }
    }
    return Object.keys(map).length > 0 ? map : undefined;
  }, [layout, userOptions]);

  const fieldChipOptions = useMemo(() => {
    if (!userOptions) return undefined;
    const map: Record<string, { label: string; value: string; color?: string }[]> = {};
    if (!layout) return map;
    for (const section of layout.sections) {
      for (const field of section.fields) {
        if (field.fieldType === 'multi_user') map[field.fieldKey] = userOptions;
      }
    }
    return Object.keys(map).length > 0 ? map : undefined;
  }, [layout, userOptions]);

  const hasManyRelationships = useMemo(
    () => entity.relationships.filter((r) => r.type === 'hasMany'),
    [entity.relationships],
  );

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
    <div className="max-w-4xl">
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

      {/* Tabs: Detail + Related Lists */}
      <div className="border-b mb-6">
        <nav className="flex gap-0 -mb-px">
          <button
            type="button"
            onClick={() => setActiveTab('detail')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'detail'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
            }`}
          >
            Detail
          </button>
          {hasManyRelationships.map((rel) => (
            <button
              key={rel.name}
              type="button"
              onClick={() => setActiveTab(rel.name)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === rel.name
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
              }`}
            >
              {rel.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'detail' ? (
        <div className="space-y-4">
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
                fieldLookupOptions={fieldLookupOptions}
                fieldChipOptions={fieldChipOptions}
              />
            ))}

          {plugins.map((plugin) => (
            <plugin.component key={plugin.label} entity={item} />
          ))}
        </div>
      ) : (
        hasManyRelationships
          .filter((rel) => rel.name === activeTab)
          .map((rel) => (
            <EntityRelatedList
              key={rel.name}
              targetEntityType={rel.targetEntity}
              foreignKey={rel.foreignKey ?? `${entityType}Id`}
              parentId={item.id as string}
              label={rel.label}
            />
          ))
      )}

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
