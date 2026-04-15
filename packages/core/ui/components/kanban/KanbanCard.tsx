import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../../lib/utils';

interface KanbanCardProps {
  id: string;
  children: React.ReactNode;
}

export function KanbanCard({ id, children }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: 'card' },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-slot="kanban-card"
      data-dragging={isDragging || undefined}
      className={cn('touch-none cursor-grab active:cursor-grabbing', isDragging && 'opacity-40')}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}
