import { useState, useCallback, useMemo } from 'react';
import { ChevronRight, Plus, Search, Users } from 'lucide-react';
import { Eyebrow } from '@packages/ui';
import {
  LEVEL_META,
  getUnitChildren,
  getUnitMembers,
  getUnitHead,
  type OrgUnit,
  type OrgMember,
  type HealthStatus,
} from './orgHierarchyMock';

// ─── Health dot ─────────────────────────────────────────────────────

const HEALTH_DOT: Record<HealthStatus, string> = {
  healthy: 'bg-filed',
  'at-risk': 'bg-due-soon',
  critical: 'bg-signal',
};

// ─── Tree node ──────────────────────────────────────────────────────

interface TreeNodeProps {
  unit: OrgUnit;
  allUnits: OrgUnit[];
  allMembers: OrgMember[];
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
  allMembers,
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
  const members = getUnitMembers(allMembers, unit.id);
  const head = getUnitHead(allMembers, unit.headId);
  const levelMeta = LEVEL_META[unit.level];

  return (
    <div>
      {/* Node row */}
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
        {/* Expand toggle */}
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

        {/* Health dot */}
        <span className={`w-2 h-2 shrink-0 rounded-full ${HEALTH_DOT[unit.health]}`} />

        {/* Code badge */}
        <span className="font-mono text-[10px] tracking-wider text-ink-muted w-8 shrink-0">
          {unit.code}
        </span>

        {/* Name */}
        <span className={`font-sans text-[13px] truncate ${isSelected ? 'text-ink font-medium' : 'text-ink'}`}>
          {unit.name}
        </span>

        {/* Spacer */}
        <span className="flex-1" />

        {/* Level tag */}
        <span className={`px-1.5 py-0.5 text-[9px] uppercase tracking-eyebrow font-sans font-semibold ${levelMeta.color}`}>
          {levelMeta.label}
        </span>

        {/* Member count */}
        <span className="inline-flex items-center gap-1 text-[10px] text-ink-muted font-mono tabular-nums ml-1">
          <Users className="w-3 h-3" strokeWidth={1.5} />
          {members.length}
        </span>

        {/* Head initials */}
        {head && (
          <span
            className="w-5 h-5 bg-ink-muted text-paper text-[8px] font-sans font-semibold flex items-center justify-center shrink-0 ml-1"
            title={head.name}
          >
            {head.initials}
          </span>
        )}

        {/* Add child — visible on hover */}
        {unit.level !== 'division' && (
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

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={child.id}
              unit={child}
              allUnits={allUnits}
              allMembers={allMembers}
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

// ─── Main OrgTree ───────────────────────────────────────────────────

interface OrgTreeProps {
  units: OrgUnit[];
  members: OrgMember[];
  selectedId: string | null;
  onSelect: (unit: OrgUnit) => void;
  onAddChild?: (parentId: string) => void;
}

export function OrgTree({ units, members, selectedId, onSelect, onAddChild: onAddChildProp }: OrgTreeProps) {
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    for (const u of units) {
      if (units.some((c) => c.parentId === u.id)) ids.add(u.id);
    }
    return ids;
  });

  const rootUnits = useMemo(
    () => units.filter((u) => u.parentId === null).sort((a, b) => a.sortOrder - b.sortOrder),
    [units],
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
      {/* Search */}
      <div className="px-4 pt-4 pb-3">
        <Eyebrow tone="muted">Organisation</Eyebrow>
        <div className="mt-3 flex items-center gap-2 px-3 py-2 border border-rule bg-paper hover:border-ink-muted transition-colors">
          <Search className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.5} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search units…"
            className="flex-1 text-[12px] font-sans text-ink bg-transparent outline-none placeholder:text-ink-muted/60"
          />
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto pb-4">
        {rootUnits.map((unit) => (
          <TreeNode
            key={unit.id}
            unit={unit}
            allUnits={units}
            allMembers={members}
            depth={0}
            selectedId={selectedId}
            expandedIds={expandedIds}
            onSelect={onSelect}
            onToggle={onToggle}
            onAddChild={onAddChild}
          />
        ))}
      </div>

      {/* Summary */}
      <div className="px-4 py-3 border-t border-rule text-[10px] uppercase tracking-eyebrow font-sans text-ink-muted">
        {units.length} units · {members.length} members
      </div>
    </div>
  );
}
