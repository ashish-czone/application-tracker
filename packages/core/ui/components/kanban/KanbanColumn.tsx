import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../../lib/utils';
import type { KanbanColumnDef, KanbanCardData, KanbanColumnState } from './types';

interface KanbanColumnProps {
  column: KanbanColumnDef;
  cards: KanbanCardData[];
  children: React.ReactNode;
  sortableColumns?: boolean;
  state?: KanbanColumnState;
}

function buildCountLabel(rendered: number, state?: KanbanColumnState, column?: KanbanColumnDef): string {
  if (state?.total != null) return `${rendered}/${state.total}`;
  if (column?.limit != null) return `${rendered}/${column.limit}`;
  return `${rendered}`;
}

export function KanbanColumn({ column, cards, children, sortableColumns = false, state }: KanbanColumnProps) {
  const sortable = useSortable({
    id: `column:${column.id}`,
    data: { type: 'column', columnId: column.id },
    disabled: !sortableColumns,
  });

  const droppable = useDroppable({
    id: `column-body:${column.id}`,
    data: { type: 'column-body', columnId: column.id },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };

  const cardIds = cards.map((c) => c.id);
  const countLabel = buildCountLabel(cards.length, state, column);
  const showInitialSkeleton = cards.length === 0 && state?.isLoading === true;

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      data-slot="kanban-column"
      data-dragging={sortable.isDragging || undefined}
      className={cn(
        'flex flex-col w-[280px] shrink-0',
        sortable.isDragging && 'opacity-50',
      )}
    >
      <div
        data-slot="kanban-column-header"
        {...(sortableColumns ? sortable.attributes : {})}
        {...(sortableColumns ? sortable.listeners : {})}
        className={cn(sortableColumns && 'cursor-grab active:cursor-grabbing touch-none')}
      >
        <div className="flex items-center gap-2 min-w-0">
          {column.color && (
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: column.color }}
            />
          )}
          <span className="truncate">{column.label}</span>
        </div>
        <span data-slot="kanban-column-count">{countLabel}</span>
      </div>

      <div
        ref={droppable.setNodeRef}
        data-slot="kanban-column-body"
        data-over={droppable.isOver || undefined}
      >
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {children}
          {showInitialSkeleton && (
            <>
              <div data-slot="kanban-card" className="animate-pulse">
                <div className="h-3 w-3/4 rounded bg-muted/40" />
                <div className="mt-2 h-3 w-1/2 rounded bg-muted/30" />
              </div>
              <div data-slot="kanban-card" className="animate-pulse">
                <div className="h-3 w-2/3 rounded bg-muted/40" />
                <div className="mt-2 h-3 w-1/3 rounded bg-muted/30" />
              </div>
            </>
          )}
          {cards.length === 0 && !showInitialSkeleton && (
            <div data-slot="kanban-column-empty">Drop here</div>
          )}
        </SortableContext>
        {state?.footer != null && (
          <div data-slot="kanban-column-footer">{state.footer}</div>
        )}
      </div>
    </div>
  );
}
