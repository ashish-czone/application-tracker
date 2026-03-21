import { DndContext, DragOverlay, closestCenter, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@packages/ui';
import { SectionEditor } from './SectionEditor';
import { FieldCard } from './FieldCard';
import type { LayoutSection, FieldDefinition } from '../types';

interface LayoutCanvasProps {
  sections: LayoutSection[];
  onAddFieldToSection: (sectionId: string, fieldId: string) => void;
  onRemoveFieldFromSection: (sectionId: string, fieldId: string) => void;
  onReorderFields: (sectionId: string, orderedFieldIds: string[]) => void;
  onReorderSections: (orderedSectionIds: string[]) => void;
  onEditSection: (section: LayoutSection) => void;
  onDeleteSection: (sectionId: string) => void;
  onEditField: (field: FieldDefinition) => void;
  onAddSectionClick: () => void;
  onAddFieldClick: (sectionId: string) => void;
}

export function LayoutCanvas({
  sections,
  onAddFieldToSection,
  onRemoveFieldFromSection,
  onReorderFields,
  onReorderSections,
  onEditSection,
  onDeleteSection,
  onEditField,
  onAddSectionClick,
  onAddFieldClick,
}: LayoutCanvasProps) {
  const [activeField, setActiveField] = useState<FieldDefinition | null>(null);

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const data = active.data.current;
    if (data?.type === 'palette-field') {
      setActiveField(data.field);
    } else {
      // Find field in sections
      for (const section of sections) {
        const field = section.fields.find((f) => f.id === active.id);
        if (field) {
          setActiveField(field);
          break;
        }
      }
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveField(null);
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Palette field dropped on a section
    if (activeData?.type === 'palette-field' && overData?.type === 'section') {
      onAddFieldToSection(overData.sectionId, activeData.field.id);
      return;
    }

    // Palette field dropped on a field in a section — add to that section
    if (activeData?.type === 'palette-field') {
      const targetSection = findSectionByFieldId(over.id as string);
      if (targetSection) {
        onAddFieldToSection(targetSection.id, activeData.field.id);
      }
      return;
    }

    // Field reorder within/across sections
    const sourceSection = findSectionByFieldId(active.id as string);
    const targetSection = overData?.type === 'section'
      ? sections.find((s) => s.id === overData.sectionId)
      : findSectionByFieldId(over.id as string);

    if (!sourceSection || !targetSection) return;

    if (sourceSection.id === targetSection.id) {
      // Reorder within same section
      const fieldIds = sourceSection.fields.map((f) => f.id);
      const oldIndex = fieldIds.indexOf(active.id as string);
      const newIndex = fieldIds.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      const reordered = [...fieldIds];
      reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, active.id as string);
      onReorderFields(sourceSection.id, reordered);
    } else {
      // Move between sections
      onRemoveFieldFromSection(sourceSection.id, active.id as string);
      onAddFieldToSection(targetSection.id, active.id as string);
    }
  }

  function findSectionByFieldId(fieldId: string): LayoutSection | undefined {
    return sections.find((s) => s.fields.some((f) => f.id === fieldId));
  }

  // Filter out the virtual __unassigned__ section from the canvas
  const displaySections = sections.filter((s) => s.id !== '__unassigned__');

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 space-y-3">
        <SortableContext
          items={displaySections.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          {displaySections.map((section) => (
            <SectionEditor
              key={section.id}
              section={section}
              onEditSection={onEditSection}
              onDeleteSection={onDeleteSection}
              onRemoveField={onRemoveFieldFromSection}
              onEditField={onEditField}
              onAddFieldClick={onAddFieldClick}
            />
          ))}
        </SortableContext>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onAddSectionClick}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Section
        </Button>
      </div>

      <DragOverlay>
        {activeField && (
          <div className="opacity-90">
            <FieldCard field={activeField} isDragDisabled />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
