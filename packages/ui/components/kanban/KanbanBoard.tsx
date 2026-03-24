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
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => (
          <div key={col.id} className="w-72 shrink-0 space-y-2">
            <div className="h-8 bg-muted/50 rounded animate-pulse" />
            <div className="space-y-2">
              <div className="h-20 bg-muted/30 rounded animate-pulse" />
              <div className="h-20 bg-muted/30 rounded animate-pulse" />
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
      <div className="flex gap-4 overflow-x-auto pb-4">
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
