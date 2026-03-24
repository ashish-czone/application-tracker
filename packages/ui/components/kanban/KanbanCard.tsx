import { useSortable } from '@dnd-kit/react/sortable';
import { cn } from '../../lib/utils';

interface KanbanCardProps {
  id: string;
  index: number;
  column: string;
  children: React.ReactNode;
}

export function KanbanCard({ id, index, column, children }: KanbanCardProps) {
  const { ref, isDragSource } = useSortable({
    id,
    index,
    type: 'card',
    accept: 'card',
    group: column,
  });

  return (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border bg-card p-3 shadow-sm cursor-grab active:cursor-grabbing transition-all',
        isDragSource && 'opacity-50 shadow-lg ring-2 ring-primary/20',
      )}
    >
      {children}
    </div>
  );
}
