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
        'group rounded-lg border border-border/60 bg-card px-3.5 py-3 cursor-grab active:cursor-grabbing',
        'shadow-[0_1px_2px_0_rgb(0_0_0/0.04)]',
        'hover:border-border/80 transition-colors duration-150',
        isDragSource && 'opacity-40 scale-[0.97] shadow-lg ring-2 ring-primary/25 rotate-[1deg]',
      )}
    >
      {children}
    </div>
  );
}
