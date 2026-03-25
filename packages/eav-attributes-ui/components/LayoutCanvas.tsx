import { useState, useEffect, useRef, useCallback } from 'react';
import { DragDropProvider } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
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
  onReorderFields: (sectionId: string, orderedFields: { fieldId: string; columnIndex: number }[]) => void;
  onReorderSections: (orderedSectionIds: string[]) => void;
  onEditSection: (section: LayoutSection) => void;
  onDeleteSection: (sectionId: string) => void;
  onEditField: (field: FieldDefinition) => void;
  onAddSectionClick: () => void;
  onAddFieldClick: (sectionId: string) => void;
  onMoveFieldToSection?: (sourceSectionId: string, targetSectionId: string, fieldId: string) => void | Promise<void>;
}

// --- Helpers ---

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

function toSectionOrder(sections: LayoutSection[]): string[] {
  return sections.filter((s) => s.id !== '__unassigned__').map((s) => s.id);
}

/**
 * Column-aware field map: "sectionId-col0" → fieldId[], "sectionId-col1" → fieldId[]
 * For single-column sections, only col0 exists.
 */
function toColumnFieldMap(sections: LayoutSection[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const s of sections) {
    if (s.id === '__unassigned__') continue;
    if (s.columns <= 1) {
      map[`${s.id}-col0`] = s.fields.map((f) => f.id);
    } else {
      const col0: string[] = [];
      const col1: string[] = [];
      for (const f of s.fields) {
        if (f.columnIndex === 1) col1.push(f.id);
        else col0.push(f.id);
      }
      map[`${s.id}-col0`] = col0;
      map[`${s.id}-col1`] = col1;
    }
  }
  return map;
}

function fingerprint(sectionOrder: string[], fieldMap: Record<string, string[]>): string {
  return Object.entries(fieldMap)
    .map(([key, ids]) => `${key}:${[...ids].sort().join(',')}`)
    .sort()
    .join('|');
}

function getSectionId(columnKey: string): string {
  return columnKey.replace(/-col[01]$/, '');
}

// --- Sortable field item ---

function SortableField({
  field,
  index,
  groupId,
  sectionId,
  onEditField,
  onRemove,
}: {
  field: FieldDefinition;
  index: number;
  groupId: string;
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
    group: groupId,
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

// --- Sortable column container ---

function SortableColumn({
  columnKey,
  columnIndex,
  fieldIds,
  allFieldDefs,
  sectionId,
  onEditField,
  onRemoveField,
}: {
  columnKey: string;
  columnIndex: number;
  fieldIds: string[];
  allFieldDefs: React.MutableRefObject<Map<string, FieldDefinition>>;
  sectionId: string;
  onEditField: (f: FieldDefinition) => void;
  onRemoveField: (sectionId: string, fieldId: string) => void;
}) {
  // useSortable registers this column as a container that move() can resolve.
  // CollisionPriority.Normal ensures this wins over the parent section (which only accepts 'section').
  const { ref: colRef, isDropTarget } = useSortable({
    id: columnKey,
    index: columnIndex,
    type: 'column',
    accept: 'field',
    group: sectionId,
    collisionPriority: CollisionPriority.Normal,
  });

  const fields = fieldIds.map((id) => allFieldDefs.current.get(id)).filter(Boolean) as FieldDefinition[];

  return (
    <div
      ref={colRef}
      className={`flex-1 space-y-1 min-h-[60px] max-h-[400px] overflow-y-auto p-2 rounded-md border transition-colors ${
        isDropTarget
          ? 'bg-primary/5 border-primary border-dashed'
          : 'border-border/50 bg-muted/20'
      }`}
    >
      {fields.length > 0 ? (
        fields.map((field, fieldIndex) => (
          <SortableField
            key={field.id}
            field={field}
            index={fieldIndex}
            groupId={columnKey}
            sectionId={sectionId}
            onEditField={onEditField}
            onRemove={onRemoveField}
          />
        ))
      ) : (
        <div className={`flex items-center justify-center h-full min-h-[44px] text-xs text-muted-foreground border rounded ${isDropTarget ? 'border-primary border-dashed' : 'border-dashed'}`}>
          Drop fields here
        </div>
      )}
    </div>
  );
}

// --- Sortable section ---

function SortableSection({
  section,
  index,
  col0FieldIds,
  col1FieldIds,
  allFieldDefs,
  onEditSection,
  onDeleteSection,
  onRemoveField,
  onEditField,
  onAddFieldClick,
}: {
  section: LayoutSection;
  index: number;
  col0FieldIds: string[];
  col1FieldIds: string[];
  allFieldDefs: React.MutableRefObject<Map<string, FieldDefinition>>;
  onEditSection: (s: LayoutSection) => void;
  onDeleteSection: (id: string) => void;
  onRemoveField: (sectionId: string, fieldId: string) => void;
  onEditField: (f: FieldDefinition) => void;
  onAddFieldClick: (sectionId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const isTwoColumn = section.columns >= 2;
  const totalFields = col0FieldIds.length + col1FieldIds.length;

  const { ref: sectionRef, handleRef, isDragging: isSectionDragging } = useSortable({
    id: section.id,
    index,
    type: 'section',
    accept: 'section',
    collisionPriority: CollisionPriority.Low,
  });

  return (
    <div
      ref={sectionRef}
      className={`border rounded-lg transition-colors ${isSectionDragging ? 'bg-amber-50 border-amber-300 shadow-md' : ''}`}
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
            <span className="text-xs text-muted-foreground font-normal">({totalFields} fields · {section.columns} col)</span>
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
        <div className="p-2">
          {isTwoColumn ? (
            <div className="grid grid-cols-2 gap-2">
              <SortableColumn
                columnKey={`${section.id}-col0`}
                columnIndex={0}
                fieldIds={col0FieldIds}
                allFieldDefs={allFieldDefs}
                sectionId={section.id}
                onEditField={onEditField}
                onRemoveField={onRemoveField}
              />
              <SortableColumn
                columnKey={`${section.id}-col1`}
                columnIndex={1}
                fieldIds={col1FieldIds}
                allFieldDefs={allFieldDefs}
                sectionId={section.id}
                onEditField={onEditField}
                onRemoveField={onRemoveField}
              />
            </div>
          ) : (
            <SortableColumn
              columnKey={`${section.id}-col0`}
              columnIndex={0}
              fieldIds={col0FieldIds}
              allFieldDefs={allFieldDefs}
              sectionId={section.id}
              onEditField={onEditField}
              onRemoveField={onRemoveField}
            />
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

  const [sectionOrder, setSectionOrder] = useState(() => toSectionOrder(propSections));
  const [fieldMap, setFieldMap] = useState(() => toColumnFieldMap(propSections));
  const localFingerprintRef = useRef(fingerprint(toSectionOrder(propSections), toColumnFieldMap(propSections)));

  const fieldMapRef = useRef(fieldMap);
  fieldMapRef.current = fieldMap;
  const sectionOrderRef = useRef(sectionOrder);
  sectionOrderRef.current = sectionOrder;

  const preDragFieldMap = useRef(fieldMap);
  const preDragSectionOrder = useRef(sectionOrder);

  useEffect(() => {
    allFieldDefs.current = buildFieldDefs(propSections);
    sectionMeta.current = buildSectionMeta(propSections);
  }, [propSections]);

  const syncBlockedRef = useRef(false);

  useEffect(() => {
    if (syncBlockedRef.current) return;
    const newOrder = toSectionOrder(propSections);
    const newMap = toColumnFieldMap(propSections);
    const propFp = fingerprint(newOrder, newMap);
    if (propFp !== localFingerprintRef.current) {
      localFingerprintRef.current = propFp;
      setSectionOrder(newOrder);
      setFieldMap(newMap);
    }
  }, [propSections]);

  const buildReorderPayload = useCallback((sectionId: string): { fieldId: string; columnIndex: number }[] => {
    const currentMap = fieldMapRef.current;
    const col0 = (currentMap[`${sectionId}-col0`] ?? []).map((id) => ({ fieldId: id, columnIndex: 0 }));
    const col1 = (currentMap[`${sectionId}-col1`] ?? []).map((id) => ({ fieldId: id, columnIndex: 1 }));
    return [...col0, ...col1];
  }, []);

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

    const fieldId = String(source?.id ?? '');
    const preMap = preDragFieldMap.current;
    const currentMap = fieldMapRef.current;

    const prevColumnKey = Object.entries(preMap).find(([, ids]) => ids.includes(fieldId))?.[0];
    const currColumnKey = Object.entries(currentMap).find(([, ids]) => ids.includes(fieldId))?.[0];

    if (!prevColumnKey || !currColumnKey) return;

    localFingerprintRef.current = fingerprint(sectionOrderRef.current, currentMap);

    const prevSectionId = getSectionId(prevColumnKey);
    const currSectionId = getSectionId(currColumnKey);

    if (prevSectionId === currSectionId) {
      // Same section — reorder (may have moved between columns)
      onReorderFields(currSectionId, buildReorderPayload(currSectionId));
    } else {
      // Cross-section move
      syncBlockedRef.current = true;
      (async () => {
        try {
          if (onMoveFieldToSection) {
            await onMoveFieldToSection(prevSectionId, currSectionId, fieldId);
          } else {
            await onRemoveFieldFromSection(prevSectionId, fieldId);
            await onAddFieldToSection(currSectionId, fieldId);
          }
          onReorderFields(currSectionId, buildReorderPayload(currSectionId));
          onReorderFields(prevSectionId, buildReorderPayload(prevSectionId));
        } finally {
          syncBlockedRef.current = false;
        }
      })();
    }
  }, [onReorderFields, onReorderSections, onMoveFieldToSection, onRemoveFieldFromSection, onAddFieldToSection, buildReorderPayload]);

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

          return (
            <SortableSection
              key={sectionId}
              section={section}
              index={index}
              col0FieldIds={fieldMap[`${sectionId}-col0`] ?? []}
              col1FieldIds={fieldMap[`${sectionId}-col1`] ?? []}
              allFieldDefs={allFieldDefs}
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
