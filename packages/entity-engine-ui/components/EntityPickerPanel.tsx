import { useState, useMemo } from 'react';
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
  useDataGridParams,
  toast,
  type ColumnDef,
} from '@packages/ui';
import type { PickerConfig } from '@packages/entity-engine';
import type { PaginatedResponse } from '@packages/common';
import { useEntityEngine, useEntityConfig, useEntityHooks } from '../EntityEngineProvider';
import { useEntityLayout } from '../helpers/useEntityLayout';
import { buildColumnDefs } from '../helpers/buildColumnDefs';

interface EntityPickerPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pickerConfig: PickerConfig;
  sourceId: string;
  onSuccess?: () => void;
}

type Row = Record<string, unknown>;

/**
 * Slide-over panel that renders any entity's DataGrid with selection.
 * Used for association actions like "Apply to Job" or "Apply Candidate".
 */
export function EntityPickerPanel({
  open,
  onOpenChange,
  pickerConfig,
  sourceId,
  onSuccess,
}: EntityPickerPanelProps) {
  const { apiFn } = useEntityEngine();
  const queryClient = useQueryClient();
  const targetEntity = useEntityConfig(pickerConfig.entityType);
  const hooks = useEntityHooks(pickerConfig.entityType);
  const { data: layout } = useEntityLayout(pickerConfig.entityType);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { page, pageSize, sort, order, search, setPage, setPageSize, setSort, setSearch } =
    useDataGridParams({
      defaultSort: 'createdAt',
      defaultOrder: 'desc',
      defaultPageSize: 10,
    });

  const { data, isLoading } = hooks.useList({
    page,
    limit: pageSize,
    sort,
    order,
    search: search || undefined,
  });

  // Fetch existing associations when existingCheck is configured
  const existingCheck = pickerConfig.existingCheck;
  const { data: existingData } = useQuery({
    queryKey: ['picker-existing', existingCheck?.listUrl, sourceId],
    queryFn: () =>
      apiFn.get<PaginatedResponse<Row>>(
        `${existingCheck!.listUrl}?${existingCheck!.filterField}=${sourceId}&limit=1000`,
      ),
    enabled: open && !!existingCheck,
    staleTime: 30_000,
  });

  // Build set of existing target IDs
  const existingIds = useMemo(() => {
    if (!existingCheck || !existingData?.data) return new Set<string>();
    return new Set(
      existingData.data.map((r) => String(r[existingCheck.matchField] ?? '')).filter(Boolean),
    );
  }, [existingCheck, existingData]);

  const baseColumns = useMemo(() => {
    if (!layout) return [];
    const allFields = layout.sections.flatMap((s) => s.fields);
    return buildColumnDefs(allFields, { maxColumns: 5 });
  }, [layout]);

  // Append a status badge column if existingCheck is configured
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

  // Determine if a row is selectable
  const isRowSelectable = useMemo(() => {
    if (!existingCheck || existingCheck.disableSelection === false || existingIds.size === 0) {
      return undefined;
    }
    return (row: Row) => !existingIds.has(String(row.id ?? ''));
  }, [existingCheck, existingIds]);

  const handleConfirm = async () => {
    if (selectedIds.length === 0) return;

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
      onSuccess?.();
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Failed to associate records';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-3/4 max-w-3xl">
        <SheetHeader>
          <SheetTitle>Select {targetEntity.pluralName}</SheetTitle>
          <SheetDescription>
            {pickerConfig.selectionMode === 'single'
              ? `Choose a ${targetEntity.singularName.toLowerCase()}`
              : `Choose one or more ${targetEntity.pluralName.toLowerCase()}`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-auto px-6 py-4">
          <DataGrid
            columns={columns}
            data={data?.data ?? []}
            enableSelection
            selectionMode={pickerConfig.selectionMode}
            onSelectionChange={setSelectedIds}
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
            storageKey={`picker-${pickerConfig.entityType}`}
            rowClassName={(row) =>
              existingIds.has(String((row as Row).id ?? '')) ? 'opacity-50' : undefined
            }
          />
        </div>

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
      </SheetContent>
    </Sheet>
  );
}
