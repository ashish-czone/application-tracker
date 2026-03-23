import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useEntityEngine } from '../EntityEngineProvider';
import { useEntityLayout } from '../helpers/useEntityLayout';
import { buildColumnDefs } from '../helpers/buildColumnDefs';
import type { EntityRegistryEntry } from '../types';

type Row = Record<string, unknown>;

interface EntityRelatedListProps {
  /** The target entity type to show (e.g. 'applications') */
  targetEntityType: string;
  /** The foreign key field on the target entity (e.g. 'candidateId') */
  foreignKey: string;
  /** The ID of the current entity (the parent) */
  parentId: string;
  /** Display label for the section header */
  label: string;
}

/**
 * Renders a related list section on an entity detail page.
 * Shows a collapsible list of related entities filtered by foreign key.
 */
export function EntityRelatedList({ targetEntityType, foreignKey, parentId, label }: EntityRelatedListProps) {
  const navigate = useNavigate();
  const { getHooks, getEntity } = useEntityEngine();
  const [collapsed, setCollapsed] = useState(false);

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
    // Exclude the foreign key field (redundant — we know it's the parent)
    return buildColumnDefs(
      allFields.filter((f) => f.fieldKey !== foreignKey),
      { maxColumns: 4 },
    );
  }, [layout, foreignKey]);

  if (!hooks || !targetEntity) {
    return null;
  }

  const items = data?.data ?? [];

  return (
    <div className="border rounded-lg">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between w-full px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-1.5">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <span className="text-sm font-medium text-foreground">{label}</span>
          <span className="text-xs text-muted-foreground">({items.length})</span>
        </div>
      </button>

      {!collapsed && (
        <div className="px-4 py-3">
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-8 animate-pulse rounded bg-muted" />
              <div className="h-8 animate-pulse rounded bg-muted" />
            </div>
          ) : items.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {columns.map((col) => (
                    <th key={col.id} className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">
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
                      <td key={col.id} className="py-2 px-2 text-foreground">
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
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No {targetEntity.pluralName.toLowerCase()} yet
            </p>
          )}
        </div>
      )}
    </div>
  );
}
