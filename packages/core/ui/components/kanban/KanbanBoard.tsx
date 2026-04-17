import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
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

const MEASURING_CONFIG = {
  droppable: { strategy: MeasuringStrategy.Always },
};

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
  // After a successful drop, skip one useEffect sync cycle so the internal
  // card positions (set by handleDragOver) persist instead of being
  // overwritten by the stale-or-reconstructed cards prop.
  const skipSyncRef = useRef(false);
  // Collision-detection helpers: cache the last valid overId and track
  // cross-container moves so layout shifts don't produce null collisions.
  const lastOverIdRef = useRef<UniqueIdentifier | null>(null);
  const recentlyMovedRef = useRef(false);

  useEffect(() => {
    if (activeCard) return;
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
      return;
    }
    setCardsByColumn(groupCards(cards, columnIds));
  }, [cards, columnIds, activeCard]);

  // Clear recentlyMovedRef on the next animation frame after a cross-column
  // move so the collision fallback only fires during the layout-shift gap.
  useEffect(() => {
    if (recentlyMovedRef.current) {
      requestAnimationFrame(() => { recentlyMovedRef.current = false; });
    }
  }, [cardsByColumn]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Composite collision detection — dnd-kit's recommended strategy for
  // multi-container sortables (their MultipleContainers example). Uses
  // pointer position to pick the container, then closestCenter within it.
  // Prevents the "shadow at #1, drops at #2" mismatch that closestCorners
  // causes when the pointer is near column boundaries.
  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      // 1. Check pointer intersection first (most precise)
      const pointerCollisions = pointerWithin(args);
      const intersections =
        pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);
      let overId = getFirstCollision(intersections, 'id');

      if (overId != null) {
        // If the collision is with a column body, drill into its cards to
        // find the closest card within that column.
        const overContainer = args.droppableContainers.find((c) => c.id === overId);
        const overData = overContainer?.data?.current;
        if (overData?.type === 'column-body') {
          const colId = overData.columnId as string;
          const colCards = cardsByColumn[colId] ?? [];
          if (colCards.length > 0) {
            const cardContainers = args.droppableContainers.filter(
              (container) => colCards.some((c) => c.id === String(container.id)),
            );
            const innerHit = closestCenter({ ...args, droppableContainers: cardContainers });
            const innerOverId = getFirstCollision(innerHit, 'id');
            if (innerOverId != null) overId = innerOverId;
          }
        }

        lastOverIdRef.current = overId;
        return [{ id: overId }];
      }

      // Fallback: during the brief layout shift after a cross-column move,
      // collisions can return empty. Use the cached last-known overId.
      if (recentlyMovedRef.current) {
        lastOverIdRef.current = activeCard?.id ?? null;
      }

      return lastOverIdRef.current ? [{ id: lastOverIdRef.current }] : [];
    },
    [activeCard, cardsByColumn],
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

      recentlyMovedRef.current = true;
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
        skipSyncRef.current = true;
        onCardMove({ cardId, fromColumnId: fromColumn, toColumnId: toColumn, toIndex: newIndex });
      }
      return;
    }

    const list = cardsByColumn[toColumn];
    const finalIndex = list.findIndex((c) => c.id === cardId);
    if (finalIndex === -1) return;
    skipSyncRef.current = true;
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
      collisionDetection={collisionDetection}
      measuring={MEASURING_CONFIG}
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
