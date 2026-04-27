import { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, Database } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@packages/ui';
import { useEntityConfig, useEntityEngine, useEntityHooks } from '@packages/entity-engine-ui';
import { buildHierarchyRows, type HierarchyRow } from './helpers/buildHierarchyRows';
import { canDropOn } from './helpers/canDropOn';

interface HierarchyTableProps {
  entityType: string;
  /** Called when a row is clicked (ignores clicks on the expand chevron). */
  onRowClick?: (item: Record<string, unknown>) => void;
}

/**
 * Tree-style list view for entities with `hierarchy: true`.
 *
 * - Fetches the full list (paginated high) and builds an in-memory tree.
 * - Indents rows by depth, supports per-node expand/collapse.
 * - Native HTML5 drag-and-drop to reparent. Drops onto a node's own subtree
 *   are rejected client-side (and server-side, via the reparent endpoint's
 *   cycle check).
 */
export function HierarchyTable({ entityType, onRowClick }: HierarchyTableProps) {
  const entity = useEntityConfig(entityType);
  const hooks = useEntityHooks(entityType);
  const { apiFn } = useEntityEngine();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = hooks.useList({ page: 1, limit: 1000 });

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const rows = useMemo<HierarchyRow[]>(() => {
    const items = (data?.data ?? []) as Array<Record<string, unknown>>;
    return buildHierarchyRows(items, collapsed);
  }, [data, collapsed]);

  const reparent = useMutation({
    mutationFn: ({ childId, newParentId }: { childId: string; newParentId: string | null }) =>
      apiFn.post(`/${entity.slug}/${childId}/reparent`, { parentId: newParentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [entityType] });
      toast.success(`${entity.singularName} moved`);
    },
    onError: (error: any) => {
      toast.error(error?.body?.message || `Failed to move ${entity.singularName.toLowerCase()}`);
    },
  });

  const getLabel = (item: Record<string, unknown>): string => {
    const { nameField } = entity;
    const key = Array.isArray(nameField) ? nameField[0] : nameField;
    const resolved = item[`${key}__label`] ?? item[key];
    return String(resolved ?? item.id ?? '');
  };

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;
  }
  if (isError) {
    return (
      <div className="p-4 text-sm text-destructive">
        Failed to load.{' '}
        <button type="button" className="underline" onClick={() => refetch()}>
          Retry
        </button>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Database className="mx-auto h-8 w-8 mb-2 opacity-50" />
        <div className="text-sm">No {entity.pluralName.toLowerCase()} yet</div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-background">
      <ul role="tree" className="divide-y divide-border">
        {rows.map((row) => {
          const isDragging = draggingId === row.id;
          const isDropTarget = dragOverId === row.id && draggingId !== null && canDropOn(draggingId, row.id, rows);
          return (
            <li
              key={row.id}
              role="treeitem"
              aria-level={row.depth + 1}
              aria-expanded={row.hasChildren ? !row.collapsed : undefined}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                setDraggingId(row.id);
              }}
              onDragEnd={() => {
                setDraggingId(null);
                setDragOverId(null);
              }}
              onDragOver={(e) => {
                if (draggingId && canDropOn(draggingId, row.id, rows)) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverId !== row.id) setDragOverId(row.id);
                }
              }}
              onDragLeave={() => {
                if (dragOverId === row.id) setDragOverId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggingId && canDropOn(draggingId, row.id, rows)) {
                  reparent.mutate({ childId: draggingId, newParentId: row.id });
                }
                setDraggingId(null);
                setDragOverId(null);
              }}
              onClick={() => onRowClick?.(row.item)}
              className={[
                'flex items-center gap-1 px-2 py-2 text-sm cursor-grab select-none',
                isDragging ? 'opacity-40' : '',
                isDropTarget ? 'bg-primary/10 ring-1 ring-primary ring-inset' : 'hover:bg-muted/50',
              ].filter(Boolean).join(' ')}
              style={{ paddingLeft: row.depth * 20 + 8 }}
            >
              {row.hasChildren ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(row.id);
                  }}
                  className="p-0.5 rounded hover:bg-accent"
                  aria-label={row.collapsed ? 'Expand' : 'Collapse'}
                >
                  {row.collapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              ) : (
                <span className="inline-block w-5" />
              )}
              <span className="font-medium text-foreground">{getLabel(row.item)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
