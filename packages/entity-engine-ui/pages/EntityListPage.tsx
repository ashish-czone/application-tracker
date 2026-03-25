import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, RotateCcw, Database, MoreHorizontal, PenLine, Download, LayoutGrid, Table2 } from 'lucide-react';
import {
  DataGrid, DataGridFilters, Badge, Button, useDataGridParams, useActiveFilters,
  Dialog, DialogContent, ConfirmDialog,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
  type ColumnDef, type DataGridBulkAction,
} from '@packages/ui';
import type { EntityAction } from '@packages/entity-engine';
import { useEntityEngine, useEntityHooks, useEntityConfig } from '../EntityEngineProvider';
import { useEntityLayout } from '../helpers/useEntityLayout';
import { useListLayout } from '../helpers/useListLayout';
import { buildColumnDefs, buildFilterConfigs, buildLookupFilterFields } from '../helpers/buildColumnDefs';
import { EntityQuickCreateForm } from './EntityQuickCreateForm';
import { EntityBoardView } from '../components/EntityBoardView';

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
  const { apiFn } = useEntityEngine();
  const { data: layout } = useEntityLayout(entityType);
  const { data: listLayout } = useListLayout(entityType);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<Row | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);

  // Board view state
  const boardFields = entity.ui.boardFields ?? [];
  const hasBoardView = boardFields.length > 0;
  const [searchParams, setSearchParams] = useSearchParams();
  const view = hasBoardView && searchParams.get('view') === 'board' ? 'board' : 'table';
  const boardGroupBy = searchParams.get('groupBy') ?? boardFields[0] ?? '';

  const setView = (v: 'table' | 'board') => {
    setSearchParams((prev) => {
      if (v === 'board') { prev.set('view', 'board'); } else { prev.delete('view'); prev.delete('groupBy'); }
      return prev;
    }, { replace: true });
  };
  const setBoardGroupBy = (field: string) => {
    setSearchParams((prev) => { prev.set('groupBy', field); return prev; }, { replace: true });
  };

  const {
    page, pageSize, search, sort, order,
    setPage, setPageSize, setSearch, setSort,
    getFilter, setFilter, clearFilters,
  } = useDataGridParams({ defaultSort: 'createdAt', defaultOrder: 'desc' });

  // Build picklist filter configs
  const picklistFilterConfigs = useMemo(() => {
    if (!layout) return [];
    const allFields = layout.sections.flatMap((s) => s.fields);
    return buildFilterConfigs(allFields);
  }, [layout]);

  // Identify lookup fields that need async option fetching
  const lookupFilterFields = useMemo(() => {
    if (!layout) return [];
    const allFields = layout.sections.flatMap((s) => s.fields);
    return buildLookupFilterFields(allFields);
  }, [layout]);

  // Fetch lookup options for all lookup filter fields
  const { data: lookupOptionsMap } = useQuery({
    queryKey: ['lookup-filter-options', entityType, lookupFilterFields.map((f) => f.lookupEntity)],
    queryFn: async () => {
      const map: Record<string, { label: string; value: string }[]> = {};
      for (const field of lookupFilterFields) {
        try {
          const results = await apiFn.get<{ label: string; value: string }[]>(
            `/lookups/${field.lookupEntity}?limit=200`,
          );
          map[field.fieldKey] = results;
        } catch {
          map[field.fieldKey] = [];
        }
      }
      return map;
    },
    enabled: lookupFilterFields.length > 0,
  });

  // Merge picklist + lookup filter configs
  const filterConfigs = useMemo(() => {
    const lookupConfigs = lookupFilterFields
      .filter((f) => lookupOptionsMap?.[f.fieldKey]?.length)
      .map((f) => ({
        key: f.fieldKey,
        label: f.label,
        options: lookupOptionsMap![f.fieldKey],
      }));
    return [...lookupConfigs, ...picklistFilterConfigs];
  }, [picklistFilterConfigs, lookupFilterFields, lookupOptionsMap]);

  const activeFilters = useActiveFilters(filterConfigs, getFilter);

  // Build filter params for the API call
  const filterParams = useMemo(() => {
    const params: Record<string, unknown> = {};
    for (const fc of filterConfigs) {
      const val = getFilter(fc.key);
      if (val) params[fc.key] = val;
    }
    return params;
  }, [filterConfigs, getFilter]);

  const deleteMutation = hooks.useDelete({ onSuccess: () => setDeletingItem(null) });
  const restoreMutation = hooks.useRestore();

  const { data, isLoading, isError, refetch } = hooks.useList({
    page,
    limit: pageSize,
    search: search || undefined,
    sort: sort || undefined,
    order,
    includeDeleted: showDeleted,
    ...filterParams,
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
  const getDisplayName = (row: Row): string => {
    const { nameField } = entity.ui;
    if (Array.isArray(nameField)) {
      return nameField.map((f) => row[f] ?? '').filter(Boolean).join(' ');
    }
    return String(row[nameField] ?? row.id ?? '');
  };

  // Auto-generate columns from field definitions
  const columns = useMemo<ColumnDef<Row, unknown>[]>(() => {
    if (!layout) return [];

    const allFields = layout.sections.flatMap((s) => s.fields);

    // Name column (first column, links to detail page)
    const nameCol: ColumnDef<Row, unknown> = {
      id: '__name__',
      header: entity.singularName,
      cell: ({ row }) => {
        const item = row.original;
        const isDeleted = !!item.deletedAt;
        const name = getDisplayName(item);
        return (
          <div className={isDeleted ? 'opacity-50' : ''}>
            <div className="flex items-center gap-2">
              {isDeleted ? (
                <span className="font-medium text-foreground">{name}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate(`/${entity.slug}/${item.id}`)}
                  className="font-medium text-primary hover:underline text-left"
                >
                  {name}
                </button>
              )}
              {isDeleted && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">Deleted</Badge>
              )}
            </div>
          </div>
        );
      },
      enableSorting: false,
    };

    // Dynamic columns from field definitions (exclude name fields to avoid duplication)
    const nameFields = new Set(Array.isArray(entity.ui.nameField) ? entity.ui.nameField : [entity.ui.nameField]);
    const dynamicCols = buildColumnDefs(
      allFields.filter((f) => !nameFields.has(f.fieldKey)),
      { maxColumns: 6 },
    );

    // Row actions column — driven by listLayout.actions.row config
    const rowActions = listLayout?.actions.row ?? [];
    const actionsCol: ColumnDef<Row, unknown> = {
      id: '__actions__',
      header: '',
      size: 60,
      enableHiding: false,
      enableSorting: false,
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
            onClone={() => {/* TODO: clone */}}
          />
        );
      },
    };

    return [nameCol, ...dynamicCols, actionsCol];
  }, [layout, listLayout, entity, navigate]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">{entity.pluralName}</h1>
        <p className="text-sm text-muted-foreground">Manage {entity.pluralName.toLowerCase()}</p>
      </div>

      {/* View Toggle + Board GroupBy */}
      {hasBoardView && (
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center rounded-md border border-input bg-background">
            <button
              type="button"
              onClick={() => setView('table')}
              className={`p-1.5 rounded-l-md transition-colors ${view === 'table' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              aria-label="Table view"
            >
              <Table2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView('board')}
              className={`p-1.5 rounded-r-md transition-colors ${view === 'board' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              aria-label="Board view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
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

      {view === 'board' ? (
        <EntityBoardView entityType={entityType} groupByField={boardGroupBy} />
      ) : (
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
        activeFilters={activeFilters}
        onFilterRemove={(key) => setFilter(key, undefined)}
        onFiltersClear={() => clearFilters(filterConfigs.map((f) => f.key))}
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
            if (entity.ui.createMode === 'page' || entity.ui.createMode === 'wizard') {
              navigate(`/${entity.slug}/new`);
            } else {
              setAddModalOpen(true);
            }
          }},
        }}
        storageKey={`${entity.slug}-list`}
        rowClassName={(row) => (row as Row).deletedAt ? 'bg-muted/30 text-muted-foreground' : undefined}
        toolbarActions={
          <div className="flex items-center gap-2">
            {entity.features.softDelete && (
              <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showDeleted}
                  onChange={(e) => setShowDeleted(e.target.checked)}
                  className="rounded border-input"
                />
                Include deleted
              </label>
            )}
            {filterConfigs.length > 0 && (
              <DataGridFilters filters={filterConfigs} getFilter={getFilter} setFilter={setFilter} />
            )}
            <Button size="sm" onClick={() => {
              if (entity.ui.createMode === 'page' || entity.ui.createMode === 'wizard') {
                navigate(`/${entity.slug}/new`);
              } else {
                setAddModalOpen(true);
              }
            }}>
              <Plus className="h-4 w-4 mr-1" />
              Add {entity.singularName}
            </Button>
          </div>
        }
      />
      )}

      {/* Quick Create Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <EntityQuickCreateForm
            entityType={entityType}
            singularName={entity.singularName}
            onClose={() => setAddModalOpen(false)}
            onSuccess={(created) => navigate(`/${entity.slug}/${created.id}`)}
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
