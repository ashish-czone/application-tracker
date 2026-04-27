import { useState, useCallback, useMemo } from 'react';
import { ChevronRight, Plus, Users } from 'lucide-react';
import { Eyebrow, SearchInput } from '@packages/ui';
import type { OrgUnit } from '@packages/org-units-ui';
import { getUnitChildren, hasChildUnits, getInitials, levelTagClass } from '../helpers';

interface TreeNodeProps {
  unit: OrgUnit;
  allUnits: OrgUnit[];
  depth: number;
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (unit: OrgUnit) => void;
  onToggle: (id: string) => void;
  onAddChild: (parentId: string) => void;
}

function TreeNode({
  unit,
  allUnits,
  depth,
  selectedId,
  expandedIds,
  onSelect,
  onToggle,
  onAddChild,
}: TreeNodeProps) {
  const children = getUnitChildren(allUnits, unit.id);
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(unit.id);
  const isSelected = selectedId === unit.id;
  const head = unit.head;
  const isLeaf = !hasChildUnitLevel(unit, allUnits);

  return (
    <div>
      <div
        className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors border-l-2 ${
          isSelected
            ? 'border-ink bg-paper-sunken/50'
            : 'border-transparent hover:bg-paper-sunken/30'
        }`}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
        onClick={() => onSelect(unit)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') onSelect(unit); }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggle(unit.id);
          }}
          className={`w-4 h-4 flex items-center justify-center transition-transform ${
            hasChildren ? 'text-ink-muted hover:text-ink' : 'invisible'
          } ${isExpanded ? 'rotate-90' : ''}`}
        >
          <ChevronRight className="w-3 h-3" strokeWidth={2} />
        </button>

        <span className={`font-sans text-[13px] truncate ${isSelected ? 'text-ink font-medium' : 'text-ink'}`}>
          {unit.name}
        </span>

        <span className="flex-1" />

        <span className={`px-1.5 py-0.5 text-[9px] uppercase tracking-eyebrow font-sans font-semibold ${levelTagClass(unit.level.sortOrder)}`}>
          {unit.level.name}
        </span>

        <span className="inline-flex items-center gap-1 text-[10px] text-ink-muted font-mono tabular-nums ml-1">
          <Users className="w-3 h-3" strokeWidth={1.5} />
          {unit.memberCount}
        </span>

        {head && (
          <span
            className="w-5 h-5 bg-ink-muted text-paper text-[8px] font-sans font-semibold flex items-center justify-center shrink-0 ml-1"
            title={head.userName}
          >
            {getInitials(head.userName)}
          </span>
        )}

        {!isLeaf && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddChild(unit.id);
            }}
            className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-ink-muted hover:text-ink hover:bg-paper-sunken transition-all ml-1"
            title="Add child unit"
          >
            <Plus className="w-3 h-3" strokeWidth={2} />
          </button>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={child.id}
              unit={child}
              allUnits={allUnits}
              depth={depth + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={onToggle}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// A unit is a leaf iff no level with a higher sortOrder exists in the hierarchy —
// i.e. there is no valid level to nest a child under it.
function hasChildUnitLevel(unit: OrgUnit, allUnits: OrgUnit[]): boolean {
  return allUnits.some((u) => u.level.sortOrder > unit.level.sortOrder);
}

interface OrgTreeProps {
  units: OrgUnit[];
  totalMembers: number;
  selectedId: string | null;
  onSelect: (unit: OrgUnit) => void;
  onAddChild?: (parentId: string) => void;
}

export function OrgTree({ units, totalMembers, selectedId, onSelect, onAddChild: onAddChildProp }: OrgTreeProps) {
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    for (const u of units) {
      if (hasChildUnits(units, u.id)) ids.add(u.id);
    }
    return ids;
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return units;
    const needle = search.trim().toLowerCase();
    const matchIds = new Set<string>();
    for (const u of units) {
      if (u.name.toLowerCase().includes(needle)) {
        matchIds.add(u.id);
        let cur = u.parentId;
        while (cur) {
          matchIds.add(cur);
          cur = units.find((p) => p.id === cur)?.parentId ?? null;
        }
      }
    }
    return units.filter((u) => matchIds.has(u.id));
  }, [units, search]);

  const rootUnits = useMemo(
    () => filtered.filter((u) => u.parentId === null || !filtered.some((p) => p.id === u.parentId))
      .sort((a, b) => a.sortOrder - b.sortOrder),
    [filtered],
  );

  const onToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onAddChild = useCallback((parentId: string) => {
    onAddChildProp?.(parentId);
  }, [onAddChildProp]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-4 pb-3">
        <Eyebrow tone="muted">Organisation</Eyebrow>
        <SearchInput
          variant="boxed"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search units…"
          className="text-[12px] placeholder:text-ink-muted/60"
          wrapperClassName="mt-3"
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-4">
        {units.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="font-serif italic text-ink-muted text-sm">No units yet</p>
            <p className="text-[11px] text-ink-muted/70 font-sans mt-1">
              Create a root unit to get started.
            </p>
          </div>
        ) : rootUnits.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="font-serif italic text-ink-muted text-sm">No matches</p>
          </div>
        ) : (
          rootUnits.map((unit) => (
            <TreeNode
              key={unit.id}
              unit={unit}
              allUnits={filtered}
              depth={0}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={onToggle}
              onAddChild={onAddChild}
            />
          ))
        )}
      </div>

      <div className="px-4 py-3 border-t border-rule text-[10px] uppercase tracking-eyebrow font-sans text-ink-muted">
        {units.length} units · {totalMembers} members
      </div>
    </div>
  );
}
