import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../../lib/utils';
import type { KanbanColumnDef, KanbanCardData } from './types';

interface KanbanColumnProps {
  column: KanbanColumnDef;
  cards: KanbanCardData[];
  children: React.ReactNode;
  sortableColumns?: boolean;
}

export function KanbanColumn({ column, cards, children, sortableColumns = false }: KanbanColumnProps) {
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
  const limitLabel = column.limit != null ? `${cards.length}/${column.limit}` : `${cards.length}`;

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
        <span data-slot="kanban-column-count">{limitLabel}</span>
      </div>

      <div
        ref={droppable.setNodeRef}
        data-slot="kanban-column-body"
        data-over={droppable.isOver || undefined}
      >
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {children}
          {cards.length === 0 && (
            <div data-slot="kanban-column-empty">Drop here</div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}
