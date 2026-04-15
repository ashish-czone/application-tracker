import { createContext, useContext } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../../lib/utils';

type UseSortableReturn = ReturnType<typeof useSortable>;

interface SortableItemContextValue {
  attributes: UseSortableReturn['attributes'];
  listeners: UseSortableReturn['listeners'];
  isDragging: boolean;
}

const SortableItemContext = createContext<SortableItemContextValue | null>(null);

interface SortableItemProps {
  id: string;
  className?: string;
  /** When true, drag listeners attach to a SortableHandle instead of the whole item. */
  withHandle?: boolean;
  children: React.ReactNode;
}

export function SortableItem({ id, className, withHandle = false, children }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-slot="sortable-item"
      data-dragging={isDragging || undefined}
      className={cn(
        'touch-none',
        !withHandle && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50 z-10',
        className,
      )}
      {...(!withHandle ? attributes : {})}
      {...(!withHandle ? listeners : {})}
    >
      {withHandle ? (
        <SortableItemContext.Provider value={{ attributes, listeners, isDragging }}>
          {children}
        </SortableItemContext.Provider>
      ) : (
        children
      )}
    </div>
  );
}

export function SortableHandle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = useContext(SortableItemContext);
  if (!ctx) return <>{children}</>;
  return (
    <button
      type="button"
      data-slot="sortable-handle"
      aria-label="Drag handle"
      className={cn('cursor-grab active:cursor-grabbing touch-none', className)}
      {...ctx.attributes}
      {...ctx.listeners}
    >
      {children}
    </button>
  );
}
