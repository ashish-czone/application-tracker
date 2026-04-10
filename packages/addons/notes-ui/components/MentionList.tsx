import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { cn } from '@packages/ui';

interface MentionListProps {
  items: { id: string; label: string }[];
  command: (item: { id: string; label: string }) => void;
}

export const MentionList = forwardRef<{ onKeyDown: (props: { event: KeyboardEvent }) => boolean }, MentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }
        if (event.key === 'Enter') {
          if (items[selectedIndex]) {
            command(items[selectedIndex]);
          }
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="rounded-md border bg-popover p-2 text-sm text-muted-foreground shadow-md">
          No users found
        </div>
      );
    }

    return (
      <div className="rounded-md border bg-popover shadow-md overflow-hidden">
        {items.map((item, index) => {
          const initials = item.label
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);

          return (
            <button
              key={item.id}
              type="button"
              className={cn(
                'flex w-full items-center gap-2 px-3 py-1.5 text-sm text-left',
                'hover:bg-accent',
                index === selectedIndex && 'bg-accent',
              )}
              onClick={() => command(item)}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                {initials}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    );
  },
);

MentionList.displayName = 'MentionList';
