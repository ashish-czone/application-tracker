import { useState, useMemo } from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { DrawerShell, DrawerHeader, Eyebrow } from '@packages/ui';
import {
  useOrgUnitLevels,
  useCreateOrgUnit,
  type OrgUnit,
  type OrgUnitLevel,
} from '@packages/org-units-ui';
import { FieldLabel } from '../../../../../../components';
import { levelTagClass } from '../helpers';

export interface AddUnitDrawerProps {
  allUnits: OrgUnit[];
  /** Pre-set parent when opened from "Add child" in the tree. */
  presetParentId?: string | null;
  onClose?: () => void;
}

/**
 * Resolve the child level for a given parent unit by picking the level whose
 * sortOrder is immediately greater than the parent's. Returns null when the
 * parent is already at the deepest level in the hierarchy.
 */
function inferChildLevel(
  parent: OrgUnit | undefined,
  levels: OrgUnitLevel[],
): OrgUnitLevel | null {
  const sorted = [...levels].sort((a, b) => a.sortOrder - b.sortOrder);
  if (!parent) return sorted[0] ?? null;
  const deeper = sorted.filter((l) => l.sortOrder > parent.level.sortOrder);
  return deeper[0] ?? null;
}

export function AddUnitDrawer({
  allUnits,
  presetParentId,
  onClose,
}: AddUnitDrawerProps) {
  const { data: levels } = useOrgUnitLevels();
  const levelList = useMemo<OrgUnitLevel[]>(() => levels ?? [], [levels]);

  const [parentId, setParentId] = useState<string>(presetParentId ?? allUnits[0]?.id ?? '');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Parents are any unit that still has a deeper level available
  const validParents = useMemo(() => {
    return allUnits.filter((u) => {
      return levelList.some((l) => l.sortOrder > u.level.sortOrder);
    });
  }, [allUnits, levelList]);

  const parentUnit = allUnits.find((u) => u.id === parentId);
  const childLevel = inferChildLevel(parentUnit, levelList);

  const createMutation = useCreateOrgUnit({ onSuccess: () => onClose?.() });

  function handleSubmit() {
    if (!name.trim() || !childLevel) return;
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      levelId: childLevel.id,
      parentId: parentUnit?.id,
    });
  }

  const canSubmit = !!name.trim() && !!childLevel && !createMutation.isPending;

  return (
    <DrawerShell onClose={() => onClose?.()} width="lg">
      <DrawerHeader
        eyebrow={<Eyebrow tone="muted" mark="§">New Unit</Eyebrow>}
        title="Add unit"
        subtitle="Create a new organisational unit and position it within the hierarchy."
        onClose={() => onClose?.()}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-5 space-y-5">
          <div className="flex items-center gap-2 px-3 py-2 border border-rule bg-paper-sunken/40">
            <Building2 className="w-3.5 h-3.5 text-ink-muted flex-none" strokeWidth={1.5} />
            <span className="text-[11px] font-sans text-ink-muted">
              {childLevel ? (
                <>
                  This unit will be created as{' '}
                  <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] uppercase tracking-eyebrow font-semibold mx-0.5 ${levelTagClass(childLevel.sortOrder)}`}>
                    {childLevel.name}
                  </span>
                  {parentUnit && (
                    <>
                      {' '}under <span className="font-mono font-medium text-ink">{parentUnit.name}</span>
                    </>
                  )}
                </>
              ) : (
                <>No deeper level is configured — add a level in settings first.</>
              )}
            </span>
          </div>

          <FieldRow label="Parent unit" required>
            <div className="relative">
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full bg-transparent outline-none text-sm text-ink font-sans appearance-none cursor-pointer pr-6"
              >
                {validParents.length === 0 ? (
                  <option value="">— No eligible parents —</option>
                ) : (
                  validParents.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} · {u.level.name}
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-muted pointer-events-none" strokeWidth={1.5} />
            </div>
          </FieldRow>

          <FieldRow label="Unit name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={childLevel ? `e.g. ${childLevel.name} name` : 'Unit name'}
              className="w-full bg-transparent outline-none text-sm text-ink font-sans placeholder:text-ink-muted"
            />
          </FieldRow>

          <FieldRow label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this unit's responsibilities and scope"
              rows={3}
              className="w-full bg-transparent outline-none text-sm text-ink font-serif italic placeholder:text-ink-muted resize-none leading-relaxed"
            />
          </FieldRow>
        </div>
      </div>

      <footer className="px-6 pt-4 pb-6 border-t border-rule bg-paper-sunken/50 flex-none">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onClose?.()}
            className="text-[11px] uppercase tracking-eyebrow text-ink-muted font-sans font-medium hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="ml-auto px-5 py-2.5 bg-ink text-paper text-[11px] uppercase tracking-eyebrow font-sans font-semibold hover:brightness-110 transition-[filter] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createMutation.isPending ? 'Creating…' : 'Create unit'}
          </button>
        </div>
      </footer>
    </DrawerShell>
  );
}

function FieldRow({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <FieldLabel>
        {label}
        {required && <span className="text-signal ml-0.5">*</span>}
      </FieldLabel>
      <div className="border-b border-rule focus-within:border-ink transition-colors pb-1.5">
        {children}
      </div>
    </div>
  );
}
