import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ChevronDown, ChevronRight, Pencil, Trash2, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@packages/ui';
import { FieldCard } from './FieldCard';
import type { LayoutSection, FieldDefinition } from '../types';

interface SectionEditorProps {
  section: LayoutSection;
  onEditSection: (section: LayoutSection) => void;
  onDeleteSection: (sectionId: string) => void;
  onRemoveField: (sectionId: string, fieldId: string) => void;
  onEditField: (field: FieldDefinition) => void;
  onAddFieldClick: (sectionId: string) => void;
}

export function SectionEditor({
  section,
  onEditSection,
  onDeleteSection,
  onRemoveField,
  onEditField,
  onAddFieldClick,
}: SectionEditorProps) {
  const [collapsed, setCollapsed] = useState(false);

  const { setNodeRef, isOver } = useDroppable({
    id: `section-${section.id}`,
    data: { type: 'section', sectionId: section.id },
  });

  return (
    <div
      className={`border rounded-lg transition-colors ${isOver ? 'border-primary bg-primary/5' : ''}`}
    >
      {/* Section header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/40 rounded-t-lg">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-foreground/80"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {section.name}
          <span className="text-xs text-muted-foreground font-normal">
            ({section.fields.length} fields)
          </span>
        </button>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onEditSection(section)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label={`Edit ${section.name}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {section.id !== '__unassigned__' && (
            <button
              type="button"
              onClick={() => onDeleteSection(section.id)}
              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              aria-label={`Delete ${section.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Section content */}
      {!collapsed && (
        <div ref={setNodeRef} className="p-2 space-y-1 min-h-[40px]">
          <SortableContext
            items={section.fields.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            {section.fields.length > 0 ? (
              section.fields.map((field) => (
                <FieldCard
                  key={field.id}
                  field={field}
                  onClick={onEditField}
                  onRemove={(fieldId) => onRemoveField(section.id, fieldId)}
                />
              ))
            ) : (
              <div className="flex items-center justify-center py-4 text-xs text-muted-foreground border border-dashed rounded">
                Drag fields here or click "Add field"
              </div>
            )}
          </SortableContext>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full mt-1 text-xs text-muted-foreground"
            onClick={() => onAddFieldClick(section.id)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add field to section
          </Button>
        </div>
      )}
    </div>
  );
}
