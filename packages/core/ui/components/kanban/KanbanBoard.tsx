import { useState, useEffect, useRef, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import type { KanbanBoardProps, KanbanCardData } from './types';

type CardsByColumn = Record<string, KanbanCardData[]>;

function groupCards(cards: KanbanCardData[], columnIds: string[]): CardsByColumn {
  const grouped: CardsByColumn = {};
  for (const colId of columnIds) grouped[colId] = [];
  for (const card of cards) {
    if (grouped[card.columnId]) grouped[card.columnId].push(card);
  }
  return grouped;
}

export function KanbanBoard({
  columns,
  cards,
  onCardMove,
  onColumnReorder,
  renderCard,
  isLoading,
}: KanbanBoardProps) {
  const columnIds = useMemo(() => columns.map((c) => c.id), [columns]);
  const sortableColumns = !!onColumnReorder;

  const [cardsByColumn, setCardsByColumn] = useState<CardsByColumn>(() => groupCards(cards, columnIds));
  const [activeCard, setActiveCard] = useState<KanbanCardData | null>(null);
  const initialSnapshotRef = useRef<CardsByColumn>(cardsByColumn);

  useEffect(() => {
    if (activeCard) return;
    setCardsByColumn(groupCards(cards, columnIds));
  }, [cards, columnIds, activeCard]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findColumnIdContainingCard = (cardId: string, source: CardsByColumn): string | null => {
    for (const [colId, list] of Object.entries(source)) {
      if (list.some((c) => c.id === cardId)) return colId;
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const type = event.active.data.current?.type;
    if (type === 'card') {
      const id = String(event.active.id);
      const colId = findColumnIdContainingCard(id, cardsByColumn);
      if (colId) setActiveCard(cardsByColumn[colId].find((c) => c.id === id) ?? null);
    }
    initialSnapshotRef.current = cardsByColumn;
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    if (active.data.current?.type !== 'card') return;

    const activeId = String(active.id);
    const overId = String(over.id);

    setCardsByColumn((prev) => {
      const fromColumn = findColumnIdContainingCard(activeId, prev);
      if (!fromColumn) return prev;

      const overType = over.data.current?.type;
      let toColumn: string | null = null;
      if (overType === 'card') {
        toColumn = findColumnIdContainingCard(overId, prev);
      } else if (overType === 'column-body') {
        toColumn = (over.data.current as { columnId: string }).columnId;
      }
      if (!toColumn || toColumn === fromColumn) return prev;

      const sourceList = prev[fromColumn].slice();
      const cardIdx = sourceList.findIndex((c) => c.id === activeId);
      if (cardIdx === -1) return prev;
      const [card] = sourceList.splice(cardIdx, 1);
      const targetList = prev[toColumn].slice();

      let insertAt = targetList.length;
      if (overType === 'card') {
        const targetIdx = targetList.findIndex((c) => c.id === overId);
        if (targetIdx !== -1) insertAt = targetIdx;
      }
      targetList.splice(insertAt, 0, { ...card, columnId: toColumn });

      return { ...prev, [fromColumn]: sourceList, [toColumn]: targetList };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);
    if (!over) return;

    const activeType = active.data.current?.type;

    if (activeType === 'column' && sortableColumns) {
      const activeColumnId = (active.data.current as { columnId: string }).columnId;
      const overColumnId = (over.data.current as { columnId?: string } | undefined)?.columnId;
      if (!overColumnId) return;
      const fromIndex = columnIds.indexOf(activeColumnId);
      const toIndex = columnIds.indexOf(overColumnId);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
      onColumnReorder?.({ columnId: activeColumnId, fromIndex, toIndex });
      return;
    }

    if (activeType !== 'card') return;
    const cardId = String(active.id);

    const fromColumn = findColumnIdContainingCard(cardId, initialSnapshotRef.current);
    const toColumn = findColumnIdContainingCard(cardId, cardsByColumn);
    if (!fromColumn || !toColumn) return;

    if (fromColumn === toColumn) {
      const list = cardsByColumn[toColumn];
      const overId = String(over.id);
      const oldIndex = list.findIndex((c) => c.id === cardId);
      const newIndex = list.findIndex((c) => c.id === overId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        setCardsByColumn((prev) => ({ ...prev, [toColumn]: arrayMove(prev[toColumn], oldIndex, newIndex) }));
        onCardMove({ cardId, fromColumnId: fromColumn, toColumnId: toColumn, toIndex: newIndex });
      }
      return;
    }

    const list = cardsByColumn[toColumn];
    const finalIndex = list.findIndex((c) => c.id === cardId);
    if (finalIndex === -1) return;
    onCardMove({ cardId, fromColumnId: fromColumn, toColumnId: toColumn, toIndex: finalIndex });
  };

  if (isLoading) {
    return (
      <div data-slot="kanban-board" className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => (
          <div key={col.id} data-slot="kanban-column" className="flex flex-col w-[280px] shrink-0">
            <div data-slot="kanban-column-header">
              <span>{col.label}</span>
              <span data-slot="kanban-column-count">—</span>
            </div>
            <div data-slot="kanban-column-body">
              <div data-slot="kanban-card" className="animate-pulse">
                <div className="h-3 w-3/4 rounded bg-muted/40" />
                <div className="mt-2 h-3 w-1/2 rounded bg-muted/30" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveCard(null)}
    >
      <SortableContext
        items={columnIds.map((id) => `column:${id}`)}
        strategy={horizontalListSortingStrategy}
      >
        <div data-slot="kanban-board" className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => (
            <KanbanColumn
              key={col.id}
              column={col}
              cards={cardsByColumn[col.id] ?? []}
              sortableColumns={sortableColumns}
            >
              {(cardsByColumn[col.id] ?? []).map((card) => (
                <KanbanCard key={card.id} id={card.id}>
                  {renderCard(card)}
                </KanbanCard>
              ))}
            </KanbanColumn>
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeCard ? <div data-slot="kanban-card">{renderCard(activeCard)}</div> : null}
      </DragOverlay>
    </DndContext>
  );
}
