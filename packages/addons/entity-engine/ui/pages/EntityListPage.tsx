import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Plus, Trash2, RotateCcw, Database, MoreHorizontal, PenLine, Download, LayoutGrid, Table2 } from 'lucide-react';
import { fieldTypeRegistry } from '@packages/field-types';
import {
  DataGrid, Badge, Button, useDataGridParams,
  Dialog, DialogContent, ConfirmDialog,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
  type ColumnDef, type DataGridBulkAction, type DataGridFilterField,
} from '@packages/ui';
import type { EntityAction } from '@packages/entity-engine';
import { formatLabel, formatDate, formatDateTime, formatCurrency } from '@packages/common';
import { useEntityEngine, useEntityHooks, useEntityConfig } from '../EntityEngineProvider';
import { useListLayout } from '../helpers/useListLayout';
import { EntityQuickCreateForm } from './EntityQuickCreateForm';
import { EntityBoardView } from '../components/EntityBoardView';
import { EntityPickerPanel } from '../components/EntityPickerPanel';

type Row = Record<string, unknown>;

interface EntityListPageProps {
  entityType: string;
}

/**
 * Generic list page for any entity registered with the entity engine.
 * Auto-generates columns from field definitions, wires DataGrid with
 * pagination/sort/search/filters, and provides create/delete/restore.
 */
export function EntityListPage({ entityType }: EntityListPageProps) {
  const navigate = useNavigate();
  const entity = useEntityConfig(entityType);
  const hooks = useEntityHooks(entityType);
  const { apiFn, getColumnRenderer, getListViews } = useEntityEngine();
  const { data: listLayout } = useListLayout(entityType);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<Row | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [browsePanel, setBrowsePanel] = useState<{
    targetEntity: string;
    foreignKey: string;
    parentId: string;
    label: string;
  } | null>(null);

  // Board view state. Workflow fields automatically qualify as board grouping
  // candidates; explicit `presentation.boardFields` adds non-workflow picklists.
  const boardFields = useMemo(() => {
    const fromPresentation = entity.ui?.boardFields ?? [];
    const fromWorkflow = (listLayout?.columns ?? [])
      .filter((c) => c.fieldType === 'workflow')
      .map((c) => c.fieldKey);
    return [...new Set([...fromWorkflow, ...fromPresentation])];
  }, [entity.ui, listLayout]);
  const hasBoardView = boardFields.length > 0;
  const [searchParams, setSearchParams] = useSearchParams();

  // Plugin views registered via EntityEngineProvider (calendar, map, timeline, etc.)
  // Filtered by enabledFor against the entity registry entry.
  const pluginListViews = useMemo(() => {
    return getListViews(entityType).filter((p) => p.enabledFor?.(entity) ?? true);
  }, [getListViews, entityType, entity]);

  // Active view: 'table' | 'board' | <plugin-key>. URL param ?view= drives it.
  const rawView = searchParams.get('view') ?? '';
  const isBoardActive = hasBoardView && rawView === 'board';
  const activePlugin = pluginListViews.find((p) => p.key === rawView);
  const view: string = isBoardActive ? 'board' : (activePlugin?.key ?? 'table');
  const boardGroupBy = searchParams.get('groupBy') ?? boardFields[0] ?? '';

  const setView = (v: string) => {
    setSearchParams((prev) => {
      if (v === 'table') { prev.delete('view'); prev.delete('groupBy'); }
      else if (v === 'board') { prev.set('view', 'board'); }
      else { prev.set('view', v); prev.delete('groupBy'); }
      return prev;
    }, { replace: true });
  };
  const setBoardGroupBy = (field: string) => {
    setSearchParams((prev) => { prev.set('groupBy', field); return prev; }, { replace: true });
  };

  const {
    page, pageSize, search, sort, order,
    setPage, setPageSize, setSearch, setSort,
    filters, addFilter, removeFilter, clearAllFilters,
  } = useDataGridParams({ defaultSort: 'createdAt', defaultOrder: 'desc', storageKey: `${entity.slug}-list` });

  // Build filter field definitions from layout columns (driven by field type registry)
  const filterFields = useMemo<DataGridFilterField[]>(() => {
    if (!listLayout) return [];
    return listLayout.columns
      .filter((c) => {
        if (c.relationship) return false;
        const ft = fieldTypeRegistry.get(c.fieldType);
        return ft?.filterable ?? false;
      })
      .map((c) => {
        const ft = fieldTypeRegistry.get(c.fieldType);
        const field: DataGridFilterField = {
          key: c.fieldKey,
          label: c.label,
          fieldType: c.fieldType,
          operators: c.operators as any,
        };
        // Static options for picklist/multi_select
        if (c.picklistOptions?.length) {
          field.options = c.picklistOptions;
        }
        // Async search for reference fields (lookup, user, multi_lookup, multi_user, category)
        if (ft?.isReference) {
          const lookupEntity = c.lookupEntity ?? ft.defaultLookupEntity;
          if (lookupEntity) {
            field.onSearchOptions = async (query: string) => {
              try {
                return await apiFn.get<{ label: string; value: string }[]>(
                  `/lookups/${lookupEntity}?limit=50${query ? `&search=${encodeURIComponent(query)}` : ''}`,
                );
              } catch {
                return [];
              }
            };
          }
        }
        // Async search for tags (via tag group slug)
        if (c.fieldType === 'tags' && c.tagGroupSlug) {
          field.onSearchOptions = async (query: string) => {
            try {
              return await apiFn.get<{ label: string; value: string }[]>(
                `/tags/group/${c.tagGroupSlug}?limit=50${query ? `&search=${encodeURIComponent(query)}` : ''}`,
              );
            } catch {
              return [];
            }
          };
        }
        // Async search for categories (via category group slug)
        if (c.fieldType === 'category' && c.categoryGroupSlug) {
          field.onSearchOptions = async (query: string) => {
            try {
              return await apiFn.get<{ label: string; value: string }[]>(
                `/categories/group/${c.categoryGroupSlug}?limit=50${query ? `&search=${encodeURIComponent(query)}` : ''}`,
              );
            } catch {
              return [];
            }
          };
        }
        return field;
      });
  }, [listLayout, apiFn]);

  const deleteMutation = hooks.useDelete({ onSuccess: () => setDeletingItem(null) });
  const restoreMutation = hooks.useRestore();
  const cloneMutation = hooks.useClone({
    onSuccess: (created) => navigate(`/${entity.slug}/${(created as any).id}`),
  });

  const { data, isLoading, isError, refetch } = hooks.useList({
    page,
    limit: pageSize,
    search: search || undefined,
    sort: sort || undefined,
    order,
    includeDeleted: showDeleted,
    ...(filters.length > 0 ? { filters: JSON.stringify(filters) } : {}),
  });

  // ---------------------------------------------------------------------------
  // Bulk actions — driven by listLayout.actions.bulk config
  // ---------------------------------------------------------------------------

  const entityApi = useEntityEngine().getApi(entityType);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const handleBulkDelete = async (ids: string[]) => {
    setBulkDeleting(true);
    try {
      for (const id of ids) {
        await entityApi?.delete(id);
      }
    } finally {
      setBulkDeleting(false);
      setBulkDeleteIds([]);
      refetch();
    }
  };

  const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
    PenLine, Trash2, Download,
  };

  const bulkActions = useMemo<DataGridBulkAction[]>(() => {
    const configActions = listLayout?.actions.bulk ?? [];
    return configActions.map((action) => ({
      label: action.label,
      icon: action.icon ? ICON_MAP[action.icon] : undefined,
      variant: action.variant,
      onClick: (selectedIds: string[]) => {
        switch (action.key) {
          case 'massDelete':
            setBulkDeleteIds(selectedIds);
            break;
          case 'export':
            // Handled by DataGrid's built-in export button
            break;
          case 'massUpdate':
            // TODO: mass update modal
            break;
          default:
            break;
        }
      },
    }));
  }, [listLayout]);

  // Get entity display name from a row
  // For lookup fields, prefer the resolved __label over the raw UUID
  const getDisplayName = (row: Row): string => {
    const { nameField } = entity;
    const resolve = (f: string) => row[`${f}__label`] ?? row[f] ?? '';
    if (Array.isArray(nameField)) {
      return nameField.map(resolve).filter(Boolean).join(' — ');
    }
    return String(resolve(nameField) || row.id || '');
  };

  // Default column visibility from the list layout's visible flag
  const defaultColumnVisibility = useMemo<Record<string, boolean>>(() => {
    if (!listLayout) return {};
    const visibility: Record<string, boolean> = {};
    for (const col of listLayout.columns) {
      visibility[col.fieldKey] = col.visible;
    }
    return visibility;
  }, [listLayout]);

  // Build columns directly from listLayout.columns — single data source, no merging
  const columns = useMemo<ColumnDef<Row, unknown>[]>(() => {
    if (!listLayout) return [];

    // Determine which column is the navigation link (matches nameField)
    const { nameField } = entity;
    const linkFieldKey = Array.isArray(nameField) ? nameField[0] : nameField;
    const hasLinkColumn = listLayout.columns.some((c) => c.fieldKey === linkFieldKey);

    // Data columns from listLayout (sorted by order)
    const dataCols: ColumnDef<Row, unknown>[] = listLayout.columns
      .sort((a, b) => a.order - b.order)
      .map((col, idx) => {
        // The nameField column (or first column as fallback) becomes the clickable link
        const isLinkColumn = hasLinkColumn ? col.fieldKey === linkFieldKey : idx === 0;

        return {
        id: col.fieldKey,
        header: col.label,
        accessorKey: col.fieldKey,
        enableSorting: col.sortable,
        enableHiding: !isLinkColumn,
        cell: ({ getValue, row }: any) => {
          const value = getValue();
          const item = row.original;

          // Link column — render as clickable navigation to detail page
          if (isLinkColumn) {
            const isDeleted = !!item.deletedAt;
            const resolved = item[`${col.fieldKey}__label`] ?? value;
            const displayValue = (resolved != null && resolved !== '')
              ? ((col.fieldType === 'picklist' || col.fieldType === 'workflow') ? formatLabel(String(resolved)) : String(resolved))
              : String(item.id ?? '');

            return (
              <div className={isDeleted ? 'opacity-50' : ''}>
                <div className="flex items-center gap-2">
                  {isDeleted ? (
                    <span className="font-medium text-foreground">{displayValue}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigate(`/${entity.slug}/${item.id}`)}
                      className="font-medium text-primary hover:underline text-left"
                    >
                      {displayValue}
                    </button>
                  )}
                  {isDeleted && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">Deleted</Badge>
                  )}
                </div>
              </div>
            );
          }

          // Custom cell renderer (registered via EntityEngineProvider)
          if (col.cellRenderer) {
            const renderer = getColumnRenderer(col.cellRenderer);
            if (renderer) {
              const Comp = renderer.component;
              return <Comp value={value} row={row.original} entityType={entityType} />;
            }
          }

          // Relationship count columns — clickable link
          if (col.relationship) {
            if (value === null || value === undefined) return '-';
            const count = Number(value);
            if (count > 0) {
              return (
                <button
                  type="button"
                  className="text-primary hover:underline font-medium"
                  onClick={(e: any) => {
                    e.stopPropagation();
                    setBrowsePanel({
                      targetEntity: col.relationship!.targetEntity,
                      foreignKey: col.relationship!.foreignKey,
                      parentId: String(row.original.id),
                      label: col.label.replace(' Count', ''),
                    });
                  }}
                >
                  {count}
                </button>
              );
            }
            return String(count);
          }

          // Lookup/user/category — show resolved label
          if (col.fieldType === 'lookup' || col.fieldType === 'user' || col.fieldType === 'category') {
            const label = row.original[`${col.fieldKey}__label`];
            if (label != null && label !== '') return String(label);
          }

          // Tags — comma-separated names
          if (col.fieldType === 'tags') {
            if (Array.isArray(value) && value.length > 0) {
              return value.map((t: { name: string }) => t.name).join(', ');
            }
            return '-';
          }

          // Multi-user/multi-lookup — comma-separated labels
          if (col.fieldType === 'multi_user' || col.fieldType === 'multi_lookup') {
            if (Array.isArray(value) && value.length > 0) {
              return value.map((i: { label: string }) => i.label).join(', ');
            }
            return '-';
          }

          // Picklist — resolve label from options
          if (col.fieldType === 'picklist' && col.picklistOptions) {
            const opt = col.picklistOptions.find((o) => o.value === value);
            return opt?.label ?? (value != null ? String(value) : '-');
          }

          // Multi-select — resolve labels
          if (col.fieldType === 'multi_select' && col.picklistOptions) {
            if (Array.isArray(value) && value.length > 0) {
              return value
                .map((v: string) => col.picklistOptions!.find((o) => o.value === v)?.label ?? v)
                .join(', ');
            }
            return '-';
          }

          // Boolean
          if (col.fieldType === 'boolean') {
            return value === true ? 'Yes' : value === false ? 'No' : '-';
          }

          // Currency (stored as cents)
          if (col.fieldType === 'currency') {
            const num = value != null ? Number(value) : null;
            return (num == null || isNaN(num)) ? '—' : formatCurrency(num);
          }

          // Date
          if (col.fieldType === 'date' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
            return formatDate(value);
          }

          // Datetime
          if (col.fieldType === 'datetime' && (typeof value === 'string' || value instanceof Date)) {
            return formatDateTime(value as string);
          }

          // Default
          if (value === null || value === undefined || value === '') return '-';
          return String(value);
        },
      };
      });

    // Actions column (always last, not hideable)
    const rowActions = listLayout.actions.row ?? [];
    const actionsCol: ColumnDef<Row, unknown> = {
      id: '__actions__',
      header: '',
      size: 60,
      enableHiding: false,
      enableSorting: false,
      meta: { sticky: 'right' },
      cell: ({ row }) => {
        const item = row.original;
        const isDeleted = !!item.deletedAt;
        if (isDeleted) {
          return (
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => restoreMutation.mutate(item.id as string)}
                disabled={restoreMutation.isPending}
                className="p-1.5 rounded-md text-muted-foreground hover:text-success hover:bg-success/10 transition-colors"
                aria-label="Restore"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          );
        }
        return (
          <RowActionsMenu
            actions={rowActions}
            row={item}
            entitySlug={entity.slug}
            onEdit={() => navigate(`/${entity.slug}/${item.id}`)}
            onDelete={() => setDeletingItem(item)}
            onClone={() => cloneMutation.mutate(item.id as string)}
          />
        );
      },
    };

    return [...dataCols, actionsCol];
  }, [listLayout, entity, navigate]);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{entity.pluralName}</h1>
          <p className="text-sm text-muted-foreground">Manage {entity.pluralName.toLowerCase()}</p>
        </div>
        <Button size="sm" onClick={() => {
          if (entity.ui?.createMode === 'page' || entity.ui?.createMode === 'wizard') {
            navigate(`/${entity.slug}/new`);
          } else {
            setAddModalOpen(true);
          }
        }}>
          <Plus className="h-4 w-4 mr-1" />
          Add {entity.singularName}
        </Button>
      </div>

      {/* View Toggle + Board GroupBy */}
      {(hasBoardView || pluginListViews.length > 0) && (
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center rounded-md border border-input bg-background">
            <button
              type="button"
              onClick={() => setView('table')}
              className={`p-1.5 transition-colors first:rounded-l-md ${view === 'table' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              aria-label="Table view"
            >
              <Table2 className="h-4 w-4" />
            </button>
            {hasBoardView && (
              <button
                type="button"
                onClick={() => setView('board')}
                className={`p-1.5 transition-colors ${view === 'board' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                aria-label="Board view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            )}
            {pluginListViews.map((plugin, idx) => {
              const Icon = plugin.icon;
              const isLast = idx === pluginListViews.length - 1;
              return (
                <button
                  key={plugin.key}
                  type="button"
                  onClick={() => setView(plugin.key)}
                  className={`p-1.5 transition-colors ${isLast ? 'rounded-r-md' : ''} ${view === plugin.key ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  aria-label={`${plugin.label} view`}
                  title={plugin.label}
                >
                  {Icon ? <Icon className="h-4 w-4" /> : <span className="text-xs px-1">{plugin.label}</span>}
                </button>
              );
            })}
          </div>
          {view === 'board' && boardFields.length > 1 && (
            <select
              value={boardGroupBy}
              onChange={(e) => setBoardGroupBy(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              {boardFields.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {(() => {
        if (view === 'board') {
          return <EntityBoardView entityType={entityType} groupByField={boardGroupBy} />;
        }
        if (activePlugin) {
          const PluginView = activePlugin.component;
          return <PluginView entityType={entityType} />;
        }
        return null;
      })()}
      {view === 'table' && (
      <DataGrid
        columns={columns}
        data={data?.data ?? []}
        enableSelection={bulkActions.length > 0}
        bulkActions={bulkActions}
        page={page}
        pageSize={pageSize}
        pageCount={data?.meta.totalPages ?? 0}
        totalRows={data?.meta.total ?? 0}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        sortColumn={sort}
        sortDirection={order}
        onSortChange={setSort}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={`Search ${entity.pluralName.toLowerCase()}...`}
        filterFields={filterFields}
        filters={filters}
        onFilterAdd={addFilter}
        onStructuredFilterRemove={removeFilter}
        onStructuredFiltersClear={clearAllFilters}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        enableExport
        exportFilename={entity.slug}
        emptyState={{
          icon: Database,
          title: `No ${entity.pluralName.toLowerCase()} yet`,
          description: `Add your first ${entity.singularName.toLowerCase()} to get started.`,
          action: { label: `Add ${entity.singularName}`, onClick: () => {
            if (entity.ui?.createMode === 'page' || entity.ui?.createMode === 'wizard') {
              navigate(`/${entity.slug}/new`);
            } else {
              setAddModalOpen(true);
            }
          }},
        }}
        key={entity.slug}
        storageKey={`${entity.slug}-list`}
        defaultColumnVisibility={defaultColumnVisibility}
        rowClassName={(row) => (row as Row).deletedAt ? 'bg-muted/30 text-muted-foreground' : undefined}
        toolbarActions={entity.features.softDelete ? (
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
              className="rounded border-input"
            />
            Include deleted
          </label>
        ) : undefined}
      />
      )}

      {/* Quick Create Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <EntityQuickCreateForm
            entityType={entityType}
            singularName={entity.singularName}
            onClose={() => setAddModalOpen(false)}
            onSuccess={(created) => {
              const template = entity.ui?.afterCreateRoute;
              const target = template
                ? template.replace(':id', String(created.id))
                : `/${entity.slug}/${created.id}`;
              navigate(target);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Single Delete Confirmation */}
      <ConfirmDialog
        open={!!deletingItem}
        onOpenChange={(open) => !open && setDeletingItem(null)}
        title={`Delete ${entity.singularName.toLowerCase()}`}
        description={
          deletingItem
            ? `This will delete "${getDisplayName(deletingItem)}".`
            : ''
        }
        confirmLabel={`Delete ${entity.singularName.toLowerCase()}`}
        isPending={deleteMutation.isPending}
        onConfirm={() => deletingItem && deleteMutation.mutate(deletingItem.id as string)}
      />

      {/* Bulk Delete Confirmation */}
      <ConfirmDialog
        open={bulkDeleteIds.length > 0}
        onOpenChange={(open) => !open && setBulkDeleteIds([])}
        title={`Delete ${bulkDeleteIds.length} ${bulkDeleteIds.length === 1 ? entity.singularName.toLowerCase() : entity.pluralName.toLowerCase()}`}
        description={`This will delete ${bulkDeleteIds.length} selected ${bulkDeleteIds.length === 1 ? 'record' : 'records'}. This action cannot be undone.`}
        confirmLabel={`Delete ${bulkDeleteIds.length} ${bulkDeleteIds.length === 1 ? 'record' : 'records'}`}
        isPending={bulkDeleting}
        onConfirm={() => handleBulkDelete(bulkDeleteIds)}
      />

      {/* Browse panel for relationship counts */}
      {browsePanel && (
        <EntityPickerPanel
          mode="browse"
          open={!!browsePanel}
          onOpenChange={(open) => { if (!open) setBrowsePanel(null); }}
          entityType={browsePanel.targetEntity}
          title={browsePanel.label}
          filter={{ key: browsePanel.foreignKey, value: browsePanel.parentId }}
          excludeFields={[browsePanel.foreignKey]}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row Actions Dropdown Menu
// ---------------------------------------------------------------------------

function RowActionsMenu({
  actions,
  row,
  entitySlug,
  onEdit,
  onDelete,
  onClone,
}: {
  actions: EntityAction[];
  row: Row;
  entitySlug: string;
  onEdit: () => void;
  onDelete: () => void;
  onClone: () => void;
}) {
  const handleAction = (action: EntityAction) => {
    switch (action.key) {
      case 'edit': return onEdit();
      case 'delete': return onDelete();
      case 'clone': return onClone();
      default:
        // Custom actions can be handled via event dispatch or callback
        break;
    }
  };

  if (actions.length === 0) return null;

  const normalActions = actions.filter((a) => a.variant !== 'destructive');
  const destructiveActions = actions.filter((a) => a.variant === 'destructive');

  return (
    <div className="flex items-center justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Row actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {normalActions.map((action) => (
            <DropdownMenuItem key={action.key} onClick={() => handleAction(action)}>
              {action.label}
            </DropdownMenuItem>
          ))}
          {destructiveActions.length > 0 && normalActions.length > 0 && <DropdownMenuSeparator />}
          {destructiveActions.map((action) => (
            <DropdownMenuItem
              key={action.key}
              onClick={() => handleAction(action)}
              className="text-destructive focus:text-destructive"
            >
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
