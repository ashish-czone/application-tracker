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
    <div className="flex flex-col w-[280px] shrink-0">
      {/* Column header */}
      <div className="flex items-center gap-2.5 px-1 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          {color ? (
            <span
              className="h-2 w-2 rounded-full shrink-0 ring-2 ring-offset-1 ring-offset-background"
              style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}40`, ['--tw-ring-color' as string]: `${color}30` }}
            />
          ) : (
            <span className="h-2 w-2 rounded-full shrink-0 bg-muted-foreground/30" />
          )}
          <span className="text-[13px] font-semibold text-foreground tracking-tight truncate">
            {label}
          </span>
        </div>
        <span className="text-[11px] font-medium text-muted-foreground tabular-nums bg-muted/60 rounded-md px-1.5 py-0.5 shrink-0">
          {count}
        </span>
      </div>

      {/* Card drop zone */}
      <div
        ref={ref}
        className={cn(
          'flex-1 rounded-xl p-1.5 space-y-1.5 min-h-[140px] transition-all duration-200',
          isDropTarget
            ? 'bg-primary/[0.06] ring-1 ring-primary/20 ring-inset'
            : 'bg-muted/20',
        )}
      >
        {children}
        {count === 0 && (
          <div
            className={cn(
              'flex flex-col items-center justify-center h-[120px] rounded-lg border border-dashed transition-colors',
              isDropTarget
                ? 'border-primary/30 text-primary/60'
                : 'border-border/50 text-muted-foreground/40',
            )}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="mb-1.5 opacity-40">
              <rect x="3" y="3" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
              <path d="M10 7v6M7 10h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-[11px]">
              {isDropTarget ? 'Drop here' : 'No items'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
