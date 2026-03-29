import { useDraggable } from '@dnd-kit/react';
import { GripVertical, Plus } from 'lucide-react';
import { Button } from '@packages/ui';
import { FIELD_TYPE_CONFIG } from '../types';
import type { FieldDefinition, FieldType, FieldTypeRegistryEntry } from '../types';

function DraggablePaletteField({ field }: { field: FieldDefinition }) {
  const { ref, isDragSource } = useDraggable({
    id: `palette-${field.id}`,
    type: 'palette-field',
    data: { type: 'palette-field', field },
  });

  const typeConfig = FIELD_TYPE_CONFIG[field.fieldType] ?? { label: field.fieldType, color: 'bg-gray-100 text-gray-800' };

  return (
    <div
      ref={ref}
      className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm cursor-grab active:cursor-grabbing hover:border-primary/30 transition-colors ${
        isDragSource ? 'bg-amber-50 border-amber-300 shadow-md' : 'bg-background'
      }`}
    >
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="flex-1 truncate text-foreground">{field.label}</span>
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${typeConfig.color}`}>
        {typeConfig.label}
      </span>
    </div>
  );
}

interface FieldPaletteProps {
  unassignedFields: FieldDefinition[];
  onCreateField: (type: FieldType) => void;
  onCustomFieldClick: () => void;
  /** Registered field types from the backend. If not provided, uses no palette. */
  fieldTypes?: FieldTypeRegistryEntry[];
}

export function FieldPalette({ unassignedFields, onCreateField, onCustomFieldClick, fieldTypes }: FieldPaletteProps) {
  const creatableTypes = (fieldTypes ?? [])
    .filter((ft) => ft.creatable)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <div className="w-64 shrink-0 space-y-4">
      <Button size="sm" className="w-full" onClick={onCustomFieldClick}>
        <Plus className="h-4 w-4 mr-1" />
        Create Custom Field
      </Button>

      {unassignedFields.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Unassigned Fields
          </h3>
          <div className="space-y-1">
            {unassignedFields.map((field) => (
              <DraggablePaletteField key={field.id} field={field} />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Add Field Type
        </h3>
        <div className="grid grid-cols-2 gap-1">
          {creatableTypes.map((ft) => {
            const type = ft.type;
            const config = { label: ft.label, color: ft.color };
            return (
              <button
                key={type}
                type="button"
                onClick={() => onCreateField(type)}
                className="flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs text-left hover:bg-accent transition-colors"
              >
                <Plus className="h-3 w-3 text-muted-foreground" />
                <span>{config.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
