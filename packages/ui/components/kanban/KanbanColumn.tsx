import { useDroppable } from '@dnd-kit/react';
import { CollisionPriority } from '@dnd-kit/abstract';
import { cn } from '../../lib/utils';

interface KanbanColumnProps {
  id: string;
  label: string;
  color?: string;
  count: number;
  children: React.ReactNode;
}

export function KanbanColumn({ id, label, color, count, children }: KanbanColumnProps) {
  const { ref, isDropTarget } = useDroppable({
    id,
    type: 'column',
    accept: 'card',
    collisionPriority: CollisionPriority.Low,
  });

  return (
    <div className="flex flex-col w-72 shrink-0">
      <div className="flex items-center gap-2 px-3 py-2 mb-2">
        {color && (
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
        )}
        <span className="text-sm font-medium truncate">{label}</span>
        <span className="text-xs text-muted-foreground rounded-full bg-muted px-1.5 py-0.5">
          {count}
        </span>
      </div>
      <div
        ref={ref}
        className={cn(
          'flex-1 rounded-lg p-2 space-y-2 min-h-[120px] transition-colors',
          isDropTarget
            ? 'bg-primary/5 border-2 border-dashed border-primary/30'
            : 'bg-muted/30',
        )}
      >
        {children}
        {count === 0 && !isDropTarget && (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            No items
          </div>
        )}
      </div>
    </div>
  );
}
