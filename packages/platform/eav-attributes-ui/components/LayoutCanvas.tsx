import { useState, useEffect, useRef, useCallback } from 'react';
import { DragDropProvider, useDroppable } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { CollisionPriority } from '@dnd-kit/abstract';
import { move } from '@dnd-kit/helpers';
import { Plus, GripVertical, ChevronDown, ChevronRight, Pencil, Trash2, Settings2 } from 'lucide-react';
import { Button } from '@packages/ui';
import { FIELD_TYPE_CONFIG } from '../types';
import type { LayoutSection, FieldDefinition, FieldType } from '../types';

interface LayoutCanvasProps {
  sections: LayoutSection[];
  onAddFieldToSection: (sectionId: string, fieldId: string, columnIndex?: number) => void | Promise<void>;
  onRemoveFieldFromSection: (sectionId: string, fieldId: string) => void | Promise<void>;
  onReorderFields: (sectionId: string, orderedFields: { fieldId: string; columnIndex: number }[]) => void | Promise<void>;
  onReorderSections: (orderedSectionIds: string[]) => void;
  onEditSection: (section: LayoutSection) => void;
  onDeleteSection: (sectionId: string) => void;
  onEditField: (field: FieldDefinition) => void;
  onAddSectionClick: () => void;
  onAddFieldClick: (sectionId: string) => void;
  onMoveFieldToSection?: (sourceSectionId: string, targetSectionId: string, fieldId: string, targetColumnIndex: number) => void | Promise<void>;
  /**
   * Render function for sidebar content (e.g. FieldPalette).
   * Receives the current palette field IDs — during drag these update live
   * as move() shifts items between the __palette__ group and section columns.
   */
  renderSidebar?: (paletteFieldIds: string[]) => React.ReactNode;
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
 * Unassigned fields go into the "__palette__" key.
 */
function toColumnFieldMap(sections: LayoutSection[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const s of sections) {
    if (s.id === '__unassigned__') {
      map['__palette__'] = s.fields.map((f) => f.id);
      continue;
    }
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
  const sections = sectionOrder.join(',');
  const fields = Object.entries(fieldMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, ids]) => `${key}:${ids.join(',')}`)
    .join('|');
  return `${sections}||${fields}`;
}

function getSectionId(columnKey: string): string {
  return columnKey.replace(/-col[01]$/, '');
}

// --- Field type placeholder rendering ---

const INPUT_PLACEHOLDER: Partial<Record<FieldType, string>> = {
  text: 'Single line',
  email: 'user@example.com',
  phone: '+1 (555) 000-0000',
  url: 'https://',
  number: '0',
  currency: '$0.00',
  decimal: '0.00',
  date: 'MM/DD/YYYY',
  datetime: 'MM/DD/YYYY HH:MM',
  auto_number: 'Auto generated',
};

const SELECT_TYPES = new Set<FieldType>(['picklist', 'multi_select', 'lookup', 'multi_lookup', 'user', 'multi_user', 'category', 'workflow']);
const TEXTAREA_TYPES = new Set<FieldType>(['textarea', 'rich_text']);

function FieldPlaceholder({ fieldType }: { fieldType: FieldType }) {
  if (fieldType === 'boolean') {
    return <div className="h-4 w-4 rounded border border-input bg-background" />;
  }
  if (fieldType === 'tags') {
    return (
      <div className="flex gap-1">
        <span className="px-1.5 py-0.5 rounded-full bg-muted text-[10px] text-muted-foreground">tag</span>
        <span className="px-1.5 py-0.5 rounded-full bg-muted text-[10px] text-muted-foreground">tag</span>
      </div>
    );
  }
  if (fieldType === 'file') {
    return <span className="text-xs text-muted-foreground/60 italic">Attach file</span>;
  }
  if (TEXTAREA_TYPES.has(fieldType)) {
    return (
      <div className="w-full rounded border border-input bg-background px-2 pt-1 pb-3 min-h-[42px]">
        <span className="text-xs text-muted-foreground/60">{fieldType === 'rich_text' ? 'Rich text editor' : 'Multi-line text'}</span>
      </div>
    );
  }
  if (SELECT_TYPES.has(fieldType)) {
    const label = FIELD_TYPE_CONFIG[fieldType]?.label ?? 'Select';
    return (
      <div className="flex items-center justify-between w-full rounded border border-input bg-background px-2 py-1">
        <span className="text-xs text-muted-foreground/60">{label}...</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground/40" />
      </div>
    );
  }
  return (
    <div className="w-full rounded border border-input bg-background px-2 py-1">
      <span className="text-xs text-muted-foreground/60">{INPUT_PLACEHOLDER[fieldType] ?? 'Text'}</span>
    </div>
  );
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

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group relative flex items-center gap-3 rounded-md border px-2 py-2 text-sm transition-colors cursor-grab active:cursor-grabbing ${
        isDragSource ? 'bg-amber-50 border-amber-300 shadow-md' : 'bg-background'
      } ${hovered && !isDragSource ? 'border-primary/30 bg-accent/30' : ''}`}
    >
      <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />

      {/* Label */}
      <span className="w-[120px] shrink-0 text-xs font-medium text-foreground truncate">
        {field.label}
        {field.isRequired && <span className="text-destructive ml-0.5">*</span>}
      </span>

      {/* Input placeholder */}
      <div className="flex-1 min-w-0">
        <FieldPlaceholder fieldType={field.fieldType} />
      </div>

      {/* Hover actions: settings + trash */}
      <div className={`flex items-center gap-0.5 shrink-0 transition-opacity ${hovered && !isDragSource ? 'opacity-100' : 'opacity-0'}`}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEditField(field); }}
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
          aria-label={`Edit ${field.label}`}
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>
        {onRemove && !field.isSystem && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(sectionId, field.id); }}
            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            aria-label={`Remove ${field.label}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// --- Sortable column container ---

function SortableColumn({
  columnKey,
  fieldIds,
  allFieldDefs,
  sectionId,
  onEditField,
  onRemoveField,
}: {
  columnKey: string;
  fieldIds: string[];
  allFieldDefs: React.MutableRefObject<Map<string, FieldDefinition>>;
  sectionId: string;
  onEditField: (f: FieldDefinition) => void;
  onRemoveField: (sectionId: string, fieldId: string) => void;
}) {
  // useDroppable (not useSortable) for columns — columns are passive drop targets.
  // Using useSortable would register them in the OptimisticSortingPlugin's group system,
  // which corrupts field group values during cross-section drags (the plugin would mix
  // field sortables with column sortables when they collide).
  const { ref: colRef, isDropTarget } = useDroppable({
    id: columnKey,
    type: 'column',
    accept: 'field',
    collisionPriority: CollisionPriority.Normal,
  });

  const fields = fieldIds.map((id) => allFieldDefs.current.get(id)).filter(Boolean) as FieldDefinition[];

  return (
    <div
      ref={colRef}
      className={`flex-1 space-y-1 min-h-[60px] p-2 rounded-md border transition-colors ${
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
                fieldIds={col0FieldIds}
                allFieldDefs={allFieldDefs}
                sectionId={section.id}
                onEditField={onEditField}
                onRemoveField={onRemoveField}
              />
              <SortableColumn
                columnKey={`${section.id}-col1`}
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
  renderSidebar,
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

    // Field stayed in or returned to palette — no-op
    if (currColumnKey === '__palette__') return;

    // Palette → section: add field and reorder to match the drop position
    if (prevColumnKey === '__palette__') {
      const targetSectionId = getSectionId(currColumnKey);
      const targetColIdx = currColumnKey.endsWith('-col1') ? 1 : 0;

      syncBlockedRef.current = true;
      (async () => {
        try {
          await onAddFieldToSection(targetSectionId, fieldId, targetColIdx);
          await onReorderFields(targetSectionId, buildReorderPayload(targetSectionId));
          localFingerprintRef.current = fingerprint(sectionOrderRef.current, fieldMapRef.current);
        } catch {
          setFieldMap(preDragFieldMap.current);
          localFingerprintRef.current = fingerprint(sectionOrderRef.current, preDragFieldMap.current);
        } finally {
          syncBlockedRef.current = false;
        }
      })();
      return;
    }

    const prevSectionId = getSectionId(prevColumnKey);
    const currSectionId = getSectionId(currColumnKey);
    const targetColumnIndex = currColumnKey.endsWith('-col1') ? 1 : 0;

    if (prevSectionId === currSectionId) {
      // Same section — reorder (may have moved between columns)
      localFingerprintRef.current = fingerprint(sectionOrderRef.current, currentMap);
      onReorderFields(currSectionId, buildReorderPayload(currSectionId));
    } else {
      // Cross-section move — pass target column so the field is added to the correct column
      syncBlockedRef.current = true;
      (async () => {
        try {
          if (onMoveFieldToSection) {
            await onMoveFieldToSection(prevSectionId, currSectionId, fieldId, targetColumnIndex);
          } else {
            await onRemoveFieldFromSection(prevSectionId, fieldId);
            await onAddFieldToSection(currSectionId, fieldId, targetColumnIndex);
          }
          await onReorderFields(currSectionId, buildReorderPayload(currSectionId));
          await onReorderFields(prevSectionId, buildReorderPayload(prevSectionId));
          // Update fingerprint only after all mutations succeed
          localFingerprintRef.current = fingerprint(sectionOrderRef.current, fieldMapRef.current);
        } catch {
          // Rollback to pre-drag state on any failure
          setFieldMap(preDragFieldMap.current);
          setSectionOrder(preDragSectionOrder.current);
          localFingerprintRef.current = fingerprint(preDragSectionOrder.current, preDragFieldMap.current);
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
      <div className="flex gap-6">
        {renderSidebar?.(fieldMap['__palette__'] ?? [])}
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
      </div>
    </DragDropProvider>
  );
}
