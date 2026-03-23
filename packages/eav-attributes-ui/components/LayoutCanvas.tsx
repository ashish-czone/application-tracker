import { useState, useEffect, useRef, useCallback } from 'react';
import { DragDropProvider } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { useDroppable } from '@dnd-kit/react';
import { CollisionPriority } from '@dnd-kit/abstract';
import { move } from '@dnd-kit/helpers';
import { Plus, GripVertical, X, ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@packages/ui';
import { FIELD_TYPE_CONFIG } from '../types';
import type { LayoutSection, FieldDefinition } from '../types';

interface LayoutCanvasProps {
  sections: LayoutSection[];
  onAddFieldToSection: (sectionId: string, fieldId: string) => void | Promise<void>;
  onRemoveFieldFromSection: (sectionId: string, fieldId: string) => void | Promise<void>;
  onReorderFields: (sectionId: string, orderedFieldIds: string[]) => void;
  onReorderSections: (orderedSectionIds: string[]) => void;
  onEditSection: (section: LayoutSection) => void;
  onDeleteSection: (sectionId: string) => void;
  onEditField: (field: FieldDefinition) => void;
  onAddSectionClick: () => void;
  onAddFieldClick: (sectionId: string) => void;
  onMoveFieldToSection?: (sourceSectionId: string, targetSectionId: string, fieldId: string) => void | Promise<void>;
}

// --- Structure fingerprint: order-independent snapshot of which fields are in which sections ---

function structureFingerprint(sectionOrder: string[], fieldMap: Record<string, string[]>): string {
  return Object.entries(fieldMap)
    .map(([sId, fIds]) => `${sId}:${[...fIds].sort().join(',')}`)
    .sort()
    .join('|');
}

// --- Convert between LayoutSection[] and the Record<sectionId, fieldId[]> shape dnd-kit expects ---
// Excludes __unassigned__ from the field map so move() doesn't corrupt it

function toFieldMap(sections: LayoutSection[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const s of sections) {
    if (s.id === '__unassigned__') continue;
    map[s.id] = s.fields.map((f) => f.id);
  }
  return map;
}

function toSectionOrder(sections: LayoutSection[]): string[] {
  return sections.filter((s) => s.id !== '__unassigned__').map((s) => s.id);
}

function buildFieldDefs(sections: LayoutSection[]) {
  const map = new Map<string, FieldDefinition>();
  for (const s of sections) for (const f of s.fields) map.set(f.id, f);
  return map;
}

function buildSectionMeta(sections: LayoutSection[]) {
  const map = new Map<string, LayoutSection>();
  for (const s of sections) map.set(s.id, s);
  return map;
}

// --- Sortable field item ---

function SortableField({
  field,
  index,
  sectionId,
  onEditField,
  onRemove,
}: {
  field: FieldDefinition;
  index: number;
  sectionId: string;
  onEditField: (f: FieldDefinition) => void;
  onRemove?: (sectionId: string, fieldId: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const { ref, isDragSource } = useSortable({
    id: field.id,
    index,
    type: 'field',
    accept: 'field',
    group: sectionId,
  });

  const tc = FIELD_TYPE_CONFIG[field.fieldType] ?? { label: field.fieldType, color: 'bg-gray-100 text-gray-800' };
  const tierLabel = field.isSystem ? 'System' : field.isCustom ? 'Custom' : 'Standard';
  const tierColor = field.isSystem ? 'bg-slate-200 text-slate-700' : field.isCustom ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-600';

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm transition-colors cursor-grab active:cursor-grabbing ${isDragSource ? 'bg-amber-50 border-amber-300 shadow-md' : 'bg-background'} ${hovered && !isDragSource ? 'border-primary/30' : ''}`}
    >
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      <button
        type="button"
        onClick={() => onEditField(field)}
        className="flex-1 flex items-center gap-2 text-left min-w-0"
      >
        <span className="font-medium text-foreground truncate">{field.label}</span>
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${tc.color}`}>
          {tc.label}
        </span>
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${tierColor}`}>
          {tierLabel}
        </span>
        {field.isRequired && <span className="text-destructive text-xs">*</span>}
      </button>
      {onRemove && !field.isSystem && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(sectionId, field.id); }}
          className={`p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-opacity ${hovered ? 'opacity-100' : 'opacity-0'}`}
          aria-label={`Remove ${field.label}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// --- Sortable section (reorderable + droppable for fields) ---

function SortableSection({
  section,
  index,
  fieldDefs,
  onEditSection,
  onDeleteSection,
  onRemoveField,
  onEditField,
  onAddFieldClick,
}: {
  section: LayoutSection;
  index: number;
  fieldDefs: FieldDefinition[];
  onEditSection: (s: LayoutSection) => void;
  onDeleteSection: (id: string) => void;
  onRemoveField: (sectionId: string, fieldId: string) => void;
  onEditField: (f: FieldDefinition) => void;
  onAddFieldClick: (sectionId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const { ref: sectionRef, handleRef, isDragging: isSectionDragging } = useSortable({
    id: section.id,
    index,
    type: 'section',
    accept: ['field', 'section'],
    collisionPriority: CollisionPriority.Low,
  });

  const { ref: dropRef, isDropTarget } = useDroppable({
    id: `drop-${section.id}`,
    type: 'section-drop',
    accept: 'field',
    collisionPriority: CollisionPriority.Low,
  });

  return (
    <div
      ref={sectionRef}
      className={`border rounded-lg transition-colors ${isDropTarget ? 'border-primary border-dashed bg-primary/5' : ''} ${isSectionDragging ? 'bg-amber-50 border-amber-300 shadow-md' : ''}`}
    >
      <div className="flex items-center justify-between px-3 py-2 bg-muted/40 rounded-t-lg">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            ref={handleRef}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none p-0.5"
            aria-label={`Drag ${section.name}`}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-foreground/80">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {section.name}
            <span className="text-xs text-muted-foreground font-normal">({fieldDefs.length} fields)</span>
          </button>
        </div>
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={() => onEditSection(section)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label={`Edit ${section.name}`}><Pencil className="h-3.5 w-3.5" /></button>
          {section.id !== '__unassigned__' && (
            <button type="button" onClick={() => onDeleteSection(section.id)}
              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              aria-label={`Delete ${section.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
          )}
        </div>
      </div>

      {!collapsed && (
        <div ref={dropRef} className="p-2 space-y-1 min-h-[40px]">
          {fieldDefs.length > 0 ? (
            fieldDefs.map((field, fieldIndex) => (
              <SortableField
                key={field.id}
                field={field}
                index={fieldIndex}
                sectionId={section.id}
                onEditField={onEditField}
                onRemove={onRemoveField}
              />
            ))
          ) : (
            <div className={`flex items-center justify-center py-4 text-xs text-muted-foreground border rounded ${isDropTarget ? 'border-primary border-dashed' : 'border-dashed'}`}>
              Drop fields here
            </div>
          )}

          <Button type="button" variant="ghost" size="sm"
            className="w-full mt-1 text-xs text-muted-foreground"
            onClick={() => onAddFieldClick(section.id)}>
            <Plus className="h-3 w-3 mr-1" />
            Add field to section
          </Button>
        </div>
      )}
    </div>
  );
}

// --- Main LayoutCanvas ---

export function LayoutCanvas({
  sections: propSections,
  onAddFieldToSection,
  onRemoveFieldFromSection,
  onReorderFields,
  onReorderSections,
  onEditSection,
  onDeleteSection,
  onEditField,
  onAddSectionClick,
  onAddFieldClick,
  onMoveFieldToSection,
}: LayoutCanvasProps) {
  const allFieldDefs = useRef(buildFieldDefs(propSections));
  const sectionMeta = useRef(buildSectionMeta(propSections));

  // Local state: section order + which field IDs are in which section
  const [sectionOrder, setSectionOrder] = useState(() => toSectionOrder(propSections));
  const [fieldMap, setFieldMap] = useState(() => toFieldMap(propSections));
  const localFingerprintRef = useRef(structureFingerprint(toSectionOrder(propSections), toFieldMap(propSections)));

  // Refs for latest values (avoids stale closures in drag handlers)
  const fieldMapRef = useRef(fieldMap);
  fieldMapRef.current = fieldMap;
  const sectionOrderRef = useRef(sectionOrder);
  sectionOrderRef.current = sectionOrder;

  // Track pre-drag state for cancel rollback + diffing on dragEnd
  const preDragFieldMap = useRef(fieldMap);
  const preDragSectionOrder = useRef(sectionOrder);

  // Keep lookups in sync when props change
  useEffect(() => {
    allFieldDefs.current = buildFieldDefs(propSections);
    sectionMeta.current = buildSectionMeta(propSections);
  }, [propSections]);

  // Block prop sync during multi-step server operations (cross-section move)
  const syncBlockedRef = useRef(false);

  // Sync from props only on structural changes (fields added/removed)
  useEffect(() => {
    if (syncBlockedRef.current) return;
    const newOrder = toSectionOrder(propSections);
    const newMap = toFieldMap(propSections);
    const propFingerprint = structureFingerprint(newOrder, newMap);
    if (propFingerprint !== localFingerprintRef.current) {
      localFingerprintRef.current = propFingerprint;
      setSectionOrder(newOrder);
      setFieldMap(newMap);
    }
  }, [propSections]);

  // --- Drag handlers (use refs to avoid stale closures) ---

  const handleDragStart = useCallback(() => {
    preDragFieldMap.current = fieldMapRef.current;
    preDragSectionOrder.current = sectionOrderRef.current;
  }, []);

  const handleDragOver = useCallback((event: any) => {
    const { source } = event.operation;
    if (source?.type === 'section') return;
    setFieldMap((current) => move(current, event));
  }, []);

  const handleDragEnd = useCallback((event: any) => {
    const { source } = event.operation;

    if (event.canceled) {
      setFieldMap(preDragFieldMap.current);
      setSectionOrder(preDragSectionOrder.current);
      return;
    }

    if (source?.type === 'section') {
      setSectionOrder((current) => move(current, event));
      setTimeout(() => {
        onReorderSections(sectionOrderRef.current);
      }, 0);
      return;
    }

    // Field drag ended — compare pre-drag vs current to determine what changed
    const fieldId = String(source?.id ?? '');
    const preMap = preDragFieldMap.current;
    const currentMap = fieldMapRef.current;

    const prevSection = Object.entries(preMap).find(([, ids]) => ids.includes(fieldId))?.[0];
    const currSection = Object.entries(currentMap).find(([, ids]) => ids.includes(fieldId))?.[0];

    if (!prevSection || !currSection) return;

    // Update fingerprint to match current local state
    localFingerprintRef.current = structureFingerprint(sectionOrderRef.current, currentMap);

    if (prevSection === currSection) {
      onReorderFields(currSection, currentMap[currSection]);
    } else {
      // Cross-section move: block prop sync during the entire operation
      // to prevent intermediate refetches from overwriting local state
      const targetOrder = currentMap[currSection];
      syncBlockedRef.current = true;
      (async () => {
        try {
          if (onMoveFieldToSection) {
            await onMoveFieldToSection(prevSection, currSection, fieldId);
          } else {
            await onRemoveFieldFromSection(prevSection, fieldId);
            await onAddFieldToSection(currSection, fieldId);
          }
          // Server appends to end — reorder to match where the user actually dropped it
          onReorderFields(currSection, targetOrder);
        } finally {
          syncBlockedRef.current = false;
        }
      })();
    }
  }, [onReorderFields, onReorderSections, onMoveFieldToSection, onRemoveFieldFromSection, onAddFieldToSection]);

  return (
    <DragDropProvider
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex-1 space-y-3">
        {sectionOrder.map((sectionId, index) => {
          const section = sectionMeta.current.get(sectionId);
          if (!section) return null;
          const fieldIds = fieldMap[sectionId] ?? [];
          const fields = fieldIds.map((id) => allFieldDefs.current.get(id)).filter(Boolean) as FieldDefinition[];

          return (
            <SortableSection
              key={sectionId}
              section={section}
              index={index}
              fieldDefs={fields}
              onEditSection={onEditSection}
              onDeleteSection={onDeleteSection}
              onRemoveField={onRemoveFieldFromSection}
              onEditField={onEditField}
              onAddFieldClick={onAddFieldClick}
            />
          );
        })}

        <Button type="button" variant="outline" size="sm" className="w-full" onClick={onAddSectionClick}>
          <Plus className="h-4 w-4 mr-1" />
          Add Section
        </Button>
      </div>
    </DragDropProvider>
  );
}
