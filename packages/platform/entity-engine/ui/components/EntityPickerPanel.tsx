import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  Button,
  Badge,
  DataGrid,
  toast,
  type ColumnDef,
} from '@packages/ui';
import type { PickerConfig } from '@packages/entity-engine';
import type { PaginatedResponse } from '@packages/common';
import { useEntityEngine, useEntityConfig, useEntityHooks } from '../EntityEngineProvider';
import { useEntityLayout } from '../helpers/useEntityLayout';
import { buildColumnDefs } from '../helpers/buildColumnDefs';

type Row = Record<string, unknown>;

interface BaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The entity type to display */
  entityType: string;
  /** Title for the panel */
  title?: string;
  /** Description for the panel */
  description?: string;
}

interface BrowseMode extends BaseProps {
  mode: 'browse';
  /** Filter the list by a foreign key */
  filter?: { key: string; value: string };
  /** Fields to exclude from columns */
  excludeFields?: string[];
}

interface PickerMode extends BaseProps {
  mode: 'picker';
  pickerConfig: PickerConfig;
  sourceId: string;
  onSuccess?: () => void;
}

export type EntityPickerPanelProps = BrowseMode | PickerMode;

/**
 * Slide-over panel that renders any entity's DataGrid.
 *
 * Two modes:
 * - `browse`: read-only view of records, optionally filtered by a foreign key
 * - `picker`: selection mode with submit to an association endpoint
 */
export function EntityPickerPanel(props: EntityPickerPanelProps) {
  const { open, onOpenChange, entityType } = props;
  const { apiFn } = useEntityEngine();
  const queryClient = useQueryClient();
  const targetEntity = useEntityConfig(entityType);
  const hooks = useEntityHooks(entityType);
  const { data: layout } = useEntityLayout(entityType);

  const isPicker = props.mode === 'picker';
  const pickerConfig = isPicker ? props.pickerConfig : null;
  const sourceId = isPicker ? props.sourceId : '';
  const filter = !isPicker ? props.filter : null;
  const excludeFields = !isPicker ? (props.excludeFields ?? []) : [];

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use local state instead of URL params — this is a panel overlay, not a page
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearchRaw] = useState('');
  const [sort, setSortCol] = useState('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');

  const setSearch = useCallback((value: string) => {
    setSearchRaw(value);
    setPage(1);
  }, []);

  const setSort = useCallback((column: string, direction: 'asc' | 'desc') => {
    setSortCol(column);
    setOrder(direction);
    setPage(1);
  }, []);

  const { data, isLoading } = hooks.useList({
    ...(filter ? { [filter.key]: filter.value } : {}),
    page,
    limit: pageSize,
    sort,
    order,
    search: search || undefined,
  });

  // Existing check (picker mode only)
  const existingCheck = pickerConfig?.existingCheck;
  const { data: existingData } = useQuery({
    queryKey: ['picker-existing', existingCheck?.listUrl, sourceId],
    queryFn: () =>
      apiFn.get<PaginatedResponse<Row>>(
        `${existingCheck!.listUrl}?${existingCheck!.filterField}=${sourceId}&limit=1000`,
      ),
    enabled: open && !!existingCheck,
    staleTime: 30_000,
  });

  const existingIds = useMemo(() => {
    if (!existingCheck || !existingData?.data) return new Set<string>();
    return new Set(
      existingData.data.map((r) => String(r[existingCheck.matchField] ?? '')).filter(Boolean),
    );
  }, [existingCheck, existingData]);

  const excludeSet = useMemo(() => new Set(excludeFields), [excludeFields]);

  const baseColumns = useMemo(() => {
    if (!layout) return [];
    const allFields = layout.sections.flatMap((s) => s.fields);
    return buildColumnDefs(
      allFields.filter((f) => !excludeSet.has(f.fieldKey) && (filter ? f.fieldKey !== filter.key : true)),
      { maxColumns: 6 },
    );
  }, [layout, excludeSet, filter]);

  // Append existing-check badge column (picker mode only)
  const columns = useMemo<ColumnDef<Row, unknown>[]>(() => {
    if (!existingCheck || existingIds.size === 0) return baseColumns;

    const statusCol: ColumnDef<Row, unknown> = {
      id: '__existing_status',
      header: '',
      size: 120,
      enableSorting: false,
      cell: ({ row }) => {
        const rowId = String(row.original.id ?? '');
        if (existingIds.has(rowId)) {
          return (
            <Badge variant="secondary" className="text-xs whitespace-nowrap">
              {existingCheck.label}
            </Badge>
          );
        }
        return null;
      },
    };

    return [...baseColumns, statusCol];
  }, [baseColumns, existingCheck, existingIds]);

  const isRowSelectable = useMemo(() => {
    if (!existingCheck || existingCheck.disableSelection === false || existingIds.size === 0) {
      return undefined;
    }
    return (row: Row) => !existingIds.has(String(row.id ?? ''));
  }, [existingCheck, existingIds]);

  const handleConfirm = async () => {
    if (!pickerConfig || selectedIds.length === 0) return;

    setIsSubmitting(true);
    try {
      for (const selectedId of selectedIds) {
        const payload: Record<string, string> = {};
        for (const [field, token] of Object.entries(pickerConfig.fieldMapping)) {
          if (token === ':id') payload[field] = sourceId;
          else if (token === ':selectedId') payload[field] = selectedId;
          else payload[field] = token;
        }
        await apiFn.post(pickerConfig.submitUrl, payload);
      }

      toast.success(
        selectedIds.length === 1
          ? `${targetEntity.singularName} associated successfully`
          : `${selectedIds.length} ${targetEntity.pluralName.toLowerCase()} associated successfully`,
      );

      setSelectedIds([]);
      if (existingCheck) {
        queryClient.invalidateQueries({ queryKey: ['picker-existing', existingCheck.listUrl, sourceId] });
      }
      onOpenChange(false);
      if (isPicker) props.onSuccess?.();
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Failed to associate records';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = props.title ?? (isPicker ? `Select ${targetEntity.pluralName}` : targetEntity.pluralName);
  const description = props.description ?? (isPicker
    ? (pickerConfig?.selectionMode === 'single'
      ? `Choose a ${targetEntity.singularName.toLowerCase()}`
      : `Choose one or more ${targetEntity.pluralName.toLowerCase()}`)
    : `Showing ${targetEntity.pluralName.toLowerCase()} for this record`);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-3/4 max-w-3xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-auto px-6 py-4">
          <DataGrid
            columns={columns}
            data={data?.data ?? []}
            enableSelection={isPicker}
            selectionMode={pickerConfig?.selectionMode}
            onSelectionChange={isPicker ? setSelectedIds : undefined}
            isRowSelectable={isRowSelectable}
            page={page}
            pageSize={pageSize}
            pageCount={data?.meta?.totalPages ?? 0}
            totalRows={data?.meta?.total ?? 0}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            sortColumn={sort}
            sortDirection={order}
            onSortChange={setSort}
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={`Search ${targetEntity.pluralName.toLowerCase()}...`}
            isLoading={isLoading}
            storageKey={`panel-${entityType}`}
            rowClassName={isPicker && existingIds.size > 0
              ? (row) => existingIds.has(String((row as Row).id ?? '')) ? 'opacity-50' : undefined
              : undefined}
          />
        </div>

        {isPicker && (
          <SheetFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={selectedIds.length === 0 || isSubmitting}
            >
              {isSubmitting
                ? 'Associating...'
                : selectedIds.length === 0
                  ? 'Select to continue'
                  : `Confirm (${selectedIds.length})`}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
