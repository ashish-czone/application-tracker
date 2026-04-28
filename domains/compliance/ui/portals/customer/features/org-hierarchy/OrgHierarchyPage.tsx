import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Building2, AlertCircle } from 'lucide-react';
import { useOrgUnits } from '@packages/org-units-ui';
import type { OrgUnit } from '@packages/org-units-ui';
import { OrgTree } from './components/OrgTree';
import { UnitDetailPanel } from './components/UnitDetailPanel';
import { AddUnitDrawer } from './components/AddUnitDrawer';
import { AddMemberDrawer } from './components/AddMemberDrawer';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';

export function OrgHierarchyPage() {
  const { data: units, isLoading, isError, error } = useOrgUnits();
  const unitList = useMemo<OrgUnit[]>(() => units ?? [], [units]);

  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [addUnitOpen, setAddUnitOpen] = useState(false);
  const [addUnitParentId, setAddUnitParentId] = useState<string | null>(null);
  const [addMemberUnit, setAddMemberUnit] = useState<OrgUnit | null>(null);

  useEffect(() => {
    if (unitList.length === 0) {
      setSelectedUnitId(null);
      return;
    }
    if (!selectedUnitId || !unitList.some((u) => u.id === selectedUnitId)) {
      const firstRoot = unitList.find((u) => u.parentId === null) ?? unitList[0];
      setSelectedUnitId(firstRoot.id);
    }
  }, [unitList, selectedUnitId]);

  const selectedUnit = useMemo(
    () => unitList.find((u) => u.id === selectedUnitId) ?? null,
    [unitList, selectedUnitId],
  );

  const totalMembers = useMemo(
    () => unitList.reduce((sum, u) => sum + u.memberCount, 0),
    [unitList],
  );

  const openAddUnit = (parentId?: string) => {
    setAddUnitParentId(parentId ?? null);
    setAddUnitOpen(true);
  };

  return (
    <div className="min-h-screen bg-paper paper-grain">
      <ScreenPreviewTopBar active="org-hierarchy" />

      <div className="max-w-[1480px] mx-auto px-10 pt-8 pb-6">
        <header className="flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted flex items-center gap-1.5">
              <span>Workspace</span>
              <span className="text-ink-muted/40">›</span>
              <span>Organisation</span>
            </p>
            <h1 className="font-serif text-4xl text-ink mt-1">Organisation</h1>
            <p className="mt-2 font-serif italic text-ink-soft max-w-2xl">
              <HeaderSubtitle units={unitList} totalMembers={totalMembers} isLoading={isLoading} />
            </p>
          </div>
          <button
            type="button"
            onClick={() => openAddUnit()}
            className="flex items-center gap-2 px-4 py-2.5 bg-ink text-paper text-[11px] uppercase tracking-eyebrow font-sans font-semibold hover:bg-ink/90 transition-colors"
          >
            <Building2 className="w-3.5 h-3.5" strokeWidth={1.5} />
            Add Unit
          </button>
        </header>
      </div>

      <div className="max-w-[1480px] mx-auto px-10 pb-10">
        <div className="flex border border-rule bg-paper-raised" style={{ height: 'calc(100vh - 260px)', minHeight: '500px' }}>
          <div className="w-[420px] shrink-0 border-r border-rule overflow-hidden">
            {isLoading ? (
              <TreeSkeleton />
            ) : isError ? (
              <TreeError message={(error as Error | undefined)?.message ?? 'Failed to load units'} />
            ) : (
              <OrgTree
                units={unitList}
                totalMembers={totalMembers}
                selectedId={selectedUnit?.id ?? null}
                onSelect={(u) => setSelectedUnitId(u.id)}
                onAddChild={openAddUnit}
              />
            )}
          </div>

          <div className="flex-1 overflow-hidden">
            {isLoading ? (
              <DetailSkeleton />
            ) : selectedUnit ? (
              <UnitDetailPanel
                key={selectedUnit.id}
                unit={selectedUnit}
                allUnits={unitList}
                onAddMember={() => setAddMemberUnit(selectedUnit)}
              />
            ) : (
              <EmptySelection />
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {addUnitOpen && (
          <AddUnitDrawer
            allUnits={unitList}
            presetParentId={addUnitParentId}
            onClose={() => setAddUnitOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {addMemberUnit && (
          <AddMemberDrawer
            unit={addMemberUnit}
            onClose={() => setAddMemberUnit(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function HeaderSubtitle({
  units,
  totalMembers,
  isLoading,
}: {
  units: OrgUnit[];
  totalMembers: number;
  isLoading: boolean;
}) {
  if (isLoading) return <>Loading organisation…</>;
  if (units.length === 0) return <>No units yet — create your first unit to begin.</>;

  const byLevel = new Map<string, number>();
  for (const u of units) {
    byLevel.set(u.level.name, (byLevel.get(u.level.name) ?? 0) + 1);
  }
  const parts = Array.from(byLevel.entries())
    .map(([name, count]) => `${count} ${name.toLowerCase()}${count === 1 ? '' : 's'}`)
    .join(' · ');

  return (
    <>
      {units.length} units · {totalMembers} team members across {parts}.
    </>
  );
}

function TreeSkeleton() {
  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="h-8 bg-paper-sunken/50 mb-4" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 bg-paper-sunken/30" style={{ marginLeft: `${(i % 3) * 16}px` }} />
        ))}
      </div>
    </div>
  );
}

function TreeError({ message }: { message: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6">
      <AlertCircle className="w-10 h-10 text-signal/60 mb-4" strokeWidth={1} />
      <p className="font-serif italic text-ink-muted text-sm">Could not load units</p>
      <p className="text-[11px] text-ink-muted/70 font-sans mt-1">{message}</p>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="h-full flex flex-col px-6 pt-6">
      <div className="h-3 w-40 bg-paper-sunken/50 mb-4" />
      <div className="h-8 w-72 bg-paper-sunken/60 mb-3" />
      <div className="h-4 w-96 bg-paper-sunken/40" />
    </div>
  );
}

function EmptySelection() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-10">
      <Building2 className="w-12 h-12 text-ink-muted/30 mb-4" strokeWidth={1} />
      <p className="font-serif italic text-ink-muted text-lg">Select a unit</p>
      <p className="text-[11px] text-ink-muted/70 font-sans mt-1 max-w-xs">
        Click on an organisational unit in the tree to view its details, members, and compliance
        assignments.
      </p>
    </div>
  );
}
