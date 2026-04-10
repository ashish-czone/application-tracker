import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Database } from 'lucide-react';
import { DataGrid, Button, useDataGridParams } from '@packages/ui';
import { useEntityEngine } from '../EntityEngineProvider';
import { useEntityLayout } from '../helpers/useEntityLayout';
import { buildColumnDefs } from '../helpers/buildColumnDefs';

interface EntityRelatedListProps {
  targetEntityType: string;
  foreignKey: string;
  parentId: string;
  label: string;
}

/**
 * Renders a related entity list using the DataGrid component.
 * Used inside tabbed navigation on the entity detail page.
 */
export function EntityRelatedList({ targetEntityType, foreignKey, parentId, label }: EntityRelatedListProps) {
  const navigate = useNavigate();
  const { getHooks, getEntity } = useEntityEngine();

  const hooks = getHooks(targetEntityType);
  const targetEntity = getEntity(targetEntityType);
  const { data: layout } = useEntityLayout(targetEntityType);

  const { page, pageSize, sort, order, setPage, setPageSize, setSort } = useDataGridParams({
    defaultSort: 'createdAt',
    defaultOrder: 'desc',
    defaultPageSize: 10,
  });

  const { data, isLoading, isError, refetch } = hooks?.useList({
    [foreignKey]: parentId,
    page,
    limit: pageSize,
    sort,
    order,
  }) ?? { data: undefined, isLoading: false, isError: false, refetch: () => {} };

  const columns = useMemo(() => {
    if (!layout) return [];
    const allFields = layout.sections.flatMap((s) => s.fields);
    return buildColumnDefs(
      allFields.filter((f) => f.fieldKey !== foreignKey),
      { maxColumns: 5 },
    );
  }, [layout, foreignKey]);

  if (!hooks || !targetEntity) return null;

  return (
    <DataGrid
      columns={columns}
      data={data?.data ?? []}
      page={page}
      pageSize={pageSize}
      pageCount={data?.meta?.totalPages ?? 0}
      totalRows={data?.meta?.total ?? 0}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      sortColumn={sort}
      sortDirection={order}
      onSortChange={setSort}
      isLoading={isLoading}
      isError={isError}
      onRetry={refetch}
      rowClassName={() => 'cursor-pointer'}
      emptyState={{
        icon: Database,
        title: `No ${targetEntity.pluralName.toLowerCase()} yet`,
        description: `Add a ${targetEntity.singularName.toLowerCase()} to get started.`,
      }}
      storageKey={`related-${targetEntityType}`}
    />
  );
}
