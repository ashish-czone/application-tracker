import { useState, useRef } from 'react';
import { DragDropProvider } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { useDroppable } from '@dnd-kit/react';
import { CollisionPriority } from '@dnd-kit/abstract';
import { move } from '@dnd-kit/helpers';

// --- Sortable item (within a section) ---

function SortableItem({ id, label, index, column }: { id: string; label: string; index: number; column: string }) {
  const { ref, isDragSource } = useSortable({
    id,
    index,
    type: 'item',
    accept: 'item',
    group: column,
  });

  return (
    <>
      <div
        ref={ref}
        className={`flex items-center gap-3 p-3 border rounded-lg mb-2 cursor-grab active:cursor-grabbing ${
          isDragSource
            ? 'bg-amber-50 border-amber-300 shadow-md'
            : 'bg-background'
        }`}
      >
        <span className="text-muted-foreground">⠿</span>
        <span className="text-sm font-medium">{label}</span>
      </div>
    </>
  );
}

// --- Sortable section (reorderable + droppable for items) ---

function SortableSection({
  id,
  index,
  name,
  children,
  itemCount,
}: {
  id: string;
  index: number;
  name: string;
  children: React.ReactNode;
  itemCount: number;
}) {
  // Sortable: makes the section itself draggable/reorderable
  const { ref: sectionRef, handleRef, isDragging } = useSortable({
    id,
    index,
    type: 'column',
    accept: ['item', 'column'],
    collisionPriority: CollisionPriority.Low,
  });

  // Droppable: accepts items dropped into this section
  const { ref: dropRef, isDropTarget } = useDroppable({
    id: `drop-${id}`,
    type: 'column-drop',
    accept: 'item',
    collisionPriority: CollisionPriority.Low,
  });

  return (
    <div
      ref={sectionRef}
      className={`border rounded-lg mb-4 transition-colors ${isDropTarget ? 'border-primary border-dashed bg-primary/5' : ''} ${isDragging ? 'shadow-lg ring-2 ring-primary/20 opacity-80' : ''}`}
    >
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 rounded-t-lg">
        <button
          ref={handleRef}
          type="button"
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
          aria-label={`Drag ${name}`}
        >
          ⠿
        </button>
        <span className="text-sm font-medium">{name}</span>
        <span className="text-xs text-muted-foreground">({itemCount} items)</span>
      </div>
      <div ref={dropRef} className="p-2 min-h-[50px]">
        {children}
      </div>
    </div>
  );
}

// --- Data ---

const INITIAL_ITEMS: Record<string, { id: string; label: string }[]> = {
  'section-a': [
    { id: '1', label: 'First Name' },
    { id: '2', label: 'Last Name' },
    { id: '3', label: 'Email' },
  ],
  'section-b': [
    { id: '4', label: 'Phone' },
    { id: '5', label: 'Gender' },
  ],
  'section-c': [],
};

const SECTION_NAMES: Record<string, string> = {
  'section-a': 'Section A',
  'section-b': 'Section B',
  'section-c': 'Section C (empty)',
};

// --- Main ---

export default function DndTestPage() {
  const [items, setItems] = useState(INITIAL_ITEMS);
  const [sectionOrder, setSectionOrder] = useState(() => Object.keys(INITIAL_ITEMS));
  const previousItems = useRef(items);
  const previousOrder = useRef(sectionOrder);

  return (
    <div className="max-w-md mx-auto py-8">
      <h1 className="text-xl font-bold mb-4">DnD Test — Sections + Items</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Drag ⠿ on items to reorder/move between sections.
        Drag ⠿ on section headers to reorder sections.
      </p>

      <DragDropProvider
        onDragStart={() => {
          previousItems.current = items;
          previousOrder.current = sectionOrder;
        }}
        onDragOver={(event) => {
          const { source } = event.operation;
          if (source?.type === 'column') return; // sections don't move on dragOver
          setItems((current) => move(current, event));
        }}
        onDragEnd={(event) => {
          if (event.canceled) {
            setItems(previousItems.current);
            setSectionOrder(previousOrder.current);
            return;
          }

          const { source } = event.operation;
          if (source?.type === 'column') {
            setSectionOrder((current) => move(current, event));
          }
        }}
      >
        {sectionOrder.map((sectionId, sectionIndex) => (
          <SortableSection
            key={sectionId}
            id={sectionId}
            index={sectionIndex}
            name={SECTION_NAMES[sectionId] ?? sectionId}
            itemCount={items[sectionId]?.length ?? 0}
          >
            {(items[sectionId]?.length ?? 0) > 0 ? (
              items[sectionId].map((item, index) => (
                <SortableItem
                  key={item.id}
                  id={item.id}
                  label={item.label}
                  index={index}
                  column={sectionId}
                />
              ))
            ) : (
              <div className="flex items-center justify-center py-4 text-xs text-muted-foreground border rounded border-dashed">
                Drop items here
              </div>
            )}
          </SortableSection>
        ))}
      </DragDropProvider>

      <div className="mt-4 p-3 border rounded bg-muted/30">
        <p className="text-xs text-muted-foreground mb-1">Current state:</p>
        {sectionOrder.map((sectionId) => (
          <p key={sectionId} className="text-sm font-mono">
            {SECTION_NAMES[sectionId]}: {items[sectionId]?.map((i) => i.label).join(' → ') || '(empty)'}
          </p>
        ))}
      </div>
    </div>
  );
}
