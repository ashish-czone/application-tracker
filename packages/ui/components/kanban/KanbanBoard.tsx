import { useState, useRef, useMemo } from 'react';
import { DragDropProvider } from '@dnd-kit/react';
import { move } from '@dnd-kit/helpers';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import type { KanbanBoardProps } from './types';

export function KanbanBoard({
  columns,
  cards,
  onCardMove,
  renderCard,
  isLoading,
}: KanbanBoardProps) {
  // Group cards by column — internal state for optimistic drag reordering
  const initialGroups = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const col of columns) {
      groups[col.id] = [];
    }
    for (const card of cards) {
      if (groups[card.columnId]) {
        groups[card.columnId].push(card.id);
      }
    }
    return groups;
  }, [columns, cards]);

  const [groups, setGroups] = useState(initialGroups);
  const previousGroups = useRef(groups);
  const cardMap = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  // Sync internal state when external cards change (e.g., after mutation)
  if (JSON.stringify(initialGroups) !== JSON.stringify(previousGroups.current)) {
    setGroups(initialGroups);
    previousGroups.current = initialGroups;
  }

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-4 pt-1">
        {(columns.length > 0 ? columns : Array.from({ length: 5 })).map((col, i) => (
          <div key={(col as any)?.id ?? i} className="w-[280px] shrink-0">
            <div className="flex items-center gap-2 px-1 pb-3">
              <div className="h-2 w-2 rounded-full bg-muted animate-pulse" />
              <div className="h-4 w-20 rounded bg-muted animate-pulse" />
              <div className="h-5 w-6 rounded-md bg-muted/60 animate-pulse" />
            </div>
            <div className="rounded-xl bg-muted/20 p-1.5 space-y-1.5">
              {Array.from({ length: 2 + (i % 2) }).map((_, j) => (
                <div key={j} className="rounded-lg bg-card border border-border/40 p-3.5">
                  <div className="h-4 w-3/4 rounded bg-muted/60 animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-muted/40 animate-pulse mt-2" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <DragDropProvider
      onDragStart={() => {
        previousGroups.current = groups;
      }}
      onDragOver={(event) => {
        setGroups((current) => move(current, event));
      }}
      onDragEnd={(event) => {
        if (event.canceled) {
          setGroups(previousGroups.current);
          return;
        }

        // Find which column the card ended up in
        const { source } = event.operation;
        if (!source || source.type !== 'card') return;

        const cardId = source.id as string;
        const newGroups = groups;

        for (const [columnId, cardIds] of Object.entries(newGroups)) {
          if (cardIds.includes(cardId)) {
            const card = cardMap.get(cardId);
            if (card && card.columnId !== columnId) {
              onCardMove(cardId, columnId);
            }
            break;
          }
        }
      }}
    >
      <div className="flex gap-3 overflow-x-auto pb-4 pt-1">
        {columns.map((col) => {
          const columnCardIds = groups[col.id] ?? [];
          return (
            <KanbanColumn
              key={col.id}
              id={col.id}
              label={col.label}
              color={col.color}
              count={columnCardIds.length}
            >
              {columnCardIds.map((cardId, index) => {
                const card = cardMap.get(cardId);
                if (!card) return null;
                return (
                  <KanbanCard key={cardId} id={cardId} index={index} column={col.id}>
                    {renderCard(card)}
                  </KanbanCard>
                );
              })}
            </KanbanColumn>
          );
        })}
      </div>
    </DragDropProvider>
  );
}
