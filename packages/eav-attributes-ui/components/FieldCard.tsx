import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';
import { FIELD_TYPE_CONFIG } from '../types';
import type { FieldDefinition } from '../types';

interface FieldCardProps {
  field: FieldDefinition;
  onRemove?: (fieldId: string) => void;
  onClick?: (field: FieldDefinition) => void;
  isDragDisabled?: boolean;
}

export function FieldCard({ field, onRemove, onClick, isDragDisabled }: FieldCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id, disabled: isDragDisabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const typeConfig = FIELD_TYPE_CONFIG[field.fieldType] ?? { label: field.fieldType, color: 'bg-gray-100 text-gray-800' };
  const tierLabel = field.isSystem ? 'System' : field.isCustom ? 'Custom' : 'Standard';
  const tierColor = field.isSystem ? 'bg-slate-200 text-slate-700' : field.isCustom ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-600';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-sm group hover:border-primary/30 transition-colors"
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground touch-none"
        tabIndex={-1}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        onClick={() => onClick?.(field)}
        className="flex-1 flex items-center gap-2 text-left min-w-0"
      >
        <span className="font-medium text-foreground truncate">{field.label}</span>
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${typeConfig.color}`}>
          {typeConfig.label}
        </span>
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${tierColor}`}>
          {tierLabel}
        </span>
        {field.isRequired && (
          <span className="text-destructive text-xs">*</span>
        )}
      </button>

      {onRemove && !field.isSystem && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(field.id); }}
          className="p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
          aria-label={`Remove ${field.label}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
