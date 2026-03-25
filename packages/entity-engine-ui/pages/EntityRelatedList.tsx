import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Plus } from 'lucide-react';
import { Button } from '@packages/ui';
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
 * Renders a related entity list as a table.
 * Used inside tabbed navigation on the entity detail page.
 */
export function EntityRelatedList({ targetEntityType, foreignKey, parentId, label }: EntityRelatedListProps) {
  const navigate = useNavigate();
  const { getHooks, getEntity } = useEntityEngine();

  const hooks = getHooks(targetEntityType);
  const targetEntity = getEntity(targetEntityType);
  const { data: layout } = useEntityLayout(targetEntityType);

  const { data, isLoading } = hooks?.useList({
    [foreignKey]: parentId,
    limit: 50,
  }) ?? { data: undefined, isLoading: false };

  const columns = useMemo(() => {
    if (!layout) return [];
    const allFields = layout.sections.flatMap((s) => s.fields);
    return buildColumnDefs(
      allFields.filter((f) => f.fieldKey !== foreignKey),
      { maxColumns: 5 },
    );
  }, [layout, foreignKey]);

  if (!hooks || !targetEntity) return null;

  const items = data?.data ?? [];

  return (
    <div>
      {isLoading ? (
        <div className="space-y-2">
          <div className="h-8 animate-pulse rounded bg-muted" />
          <div className="h-8 animate-pulse rounded bg-muted" />
          <div className="h-8 animate-pulse rounded bg-muted" />
        </div>
      ) : items.length > 0 ? (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                {columns.map((col) => (
                  <th key={col.id} className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground">
                    {col.header as string}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id as string}
                  className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => navigate(`/${targetEntity.slug}/${item.id}`)}
                >
                  {columns.map((col) => (
                    <td key={col.id} className="py-2.5 px-3 text-foreground">
                      {col.cell
                        ? (col.cell as any)({ row: { original: item }, getValue: () => item[(col as any).accessorKey] })
                        : String(item[(col as any).accessorKey] ?? '-')
                      }
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 rounded-lg border border-dashed">
          <p className="text-sm text-muted-foreground mb-3">
            No {targetEntity.pluralName.toLowerCase()} yet
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/${targetEntity.slug}`)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add {targetEntity.singularName}
          </Button>
        </div>
      )}
    </div>
  );
}
