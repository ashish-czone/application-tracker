import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Building2 } from 'lucide-react';
import { Eyebrow } from '@packages/ui';
import { OrgTree } from './OrgTree';
import { UnitDetailPanel } from './UnitDetailPanel';
import { AddUnitDrawer } from './AddUnitDrawer';
import { AddMemberDrawer } from './AddMemberDrawer';
import {
  MOCK_ORG_UNITS,
  MOCK_MEMBERS,
  MOCK_LAW_ASSIGNMENTS,
  type OrgUnit,
} from './orgHierarchyMock';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';

export function OrgHierarchyPage() {
  const [selectedUnit, setSelectedUnit] = useState<OrgUnit | null>(MOCK_ORG_UNITS[0]);
  const [addUnitOpen, setAddUnitOpen] = useState(false);
  const [addUnitParentId, setAddUnitParentId] = useState<string | null>(null);
  const [addMemberUnit, setAddMemberUnit] = useState<OrgUnit | null>(null);

  const openAddUnit = (parentId?: string) => {
    setAddUnitParentId(parentId ?? null);
    setAddUnitOpen(true);
  };

  return (
    <div className="min-h-screen bg-paper paper-grain">
      <ScreenPreviewTopBar active="org-hierarchy" />

      {/* ─── Page header ─────────────────────────────────────────────────── */}
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
              {MOCK_ORG_UNITS.length} units · {MOCK_MEMBERS.length} team members across{' '}
              {MOCK_ORG_UNITS.filter((u) => u.level === 'entity').length} entities and{' '}
              {MOCK_ORG_UNITS.filter((u) => u.level === 'division').length} divisions.
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

      {/* ─── Split layout ────────────────────────────────────────────────── */}
      <div className="max-w-[1480px] mx-auto px-10 pb-10">
        <div className="flex border border-rule bg-paper-raised" style={{ height: 'calc(100vh - 260px)', minHeight: '500px' }}>
          {/* Left — tree */}
          <div className="w-[420px] shrink-0 border-r border-rule overflow-hidden">
            <OrgTree
              units={MOCK_ORG_UNITS}
              members={MOCK_MEMBERS}
              selectedId={selectedUnit?.id ?? null}
              onSelect={setSelectedUnit}
              onAddChild={openAddUnit}
            />
          </div>

          {/* Right — detail */}
          <div className="flex-1 overflow-hidden">
            {selectedUnit ? (
              <UnitDetailPanel
                key={selectedUnit.id}
                unit={selectedUnit}
                allUnits={MOCK_ORG_UNITS}
                allMembers={MOCK_MEMBERS}
                allAssignments={MOCK_LAW_ASSIGNMENTS}
                onAddMember={() => setAddMemberUnit(selectedUnit)}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center px-10">
                <Building2 className="w-12 h-12 text-ink-muted/30 mb-4" strokeWidth={1} />
                <p className="font-serif italic text-ink-muted text-lg">Select a unit</p>
                <p className="text-[11px] text-ink-muted/70 font-sans mt-1 max-w-xs">
                  Click on an organisational unit in the tree to view its details, members, and compliance assignments.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* ─── Drawers ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {addUnitOpen && (
          <AddUnitDrawer
            allUnits={MOCK_ORG_UNITS}
            allMembers={MOCK_MEMBERS}
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
