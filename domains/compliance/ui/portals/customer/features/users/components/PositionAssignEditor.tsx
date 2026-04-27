import { useMemo, useState } from 'react';
import { X, Building2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useOrgUnits,
  useOrgPositions,
  useAddOrgUnitMember,
} from '@packages/org-units-ui';

export interface PositionAssignEditorProps {
  userId: string;
  /** Unit IDs the user is already a member of — excluded from the picker. */
  excludeUnitIds: string[];
  onClose: () => void;
}

export function PositionAssignEditor({
  userId,
  excludeUnitIds,
  onClose,
}: PositionAssignEditorProps) {
  const queryClient = useQueryClient();
  const { data: units, isLoading: unitsLoading } = useOrgUnits();
  const { data: positions, isLoading: positionsLoading } = useOrgPositions();

  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);

  const excluded = useMemo(() => new Set(excludeUnitIds), [excludeUnitIds]);
  const availableUnits = useMemo(
    () => (units ?? []).filter((u) => !excluded.has(u.id)),
    [units, excluded],
  );

  const addMember = useAddOrgUnitMember({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
  });

  const handleAdd = () => {
    if (!selectedUnitId) return;
    addMember.mutate({
      unitId: selectedUnitId,
      userId,
      data: selectedPositionId ? { positionId: selectedPositionId } : undefined,
    });
  };

  return (
    <div className="border border-rule bg-paper-raised">
      <div className="flex items-center justify-between px-3 py-2 border-b border-rule">
        <span className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted">
          Add position
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-ink-muted hover:text-ink transition-colors"
          aria-label="Close"
        >
          <X className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      </div>

      <div className="px-3 py-2 border-b border-rule">
        <div className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1.5">
          Unit
        </div>
        <div className="max-h-36 overflow-y-auto">
          {unitsLoading ? (
            <div className="py-3 text-sm font-serif italic text-ink-muted text-center">
              Loading units…
            </div>
          ) : availableUnits.length === 0 ? (
            <div className="py-3 text-sm font-serif italic text-ink-muted text-center">
              No units available.
            </div>
          ) : (
            availableUnits.map((unit) => (
              <button
                key={unit.id}
                type="button"
                onClick={() => setSelectedUnitId(unit.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-left transition-colors ${
                  selectedUnitId === unit.id
                    ? 'bg-authority/10 text-ink'
                    : 'hover:bg-paper-sunken/40 text-ink-soft'
                }`}
              >
                <Building2 className="w-3 h-3 flex-none" strokeWidth={1.5} />
                <span className="text-sm font-sans">{unit.name}</span>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="px-3 py-2 border-b border-rule">
        <div className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted mb-1.5">
          Position <span className="text-ink-muted normal-case tracking-normal font-serif italic">(optional)</span>
        </div>
        {positionsLoading ? (
          <div className="py-1 text-sm font-serif italic text-ink-muted">Loading positions…</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedPositionId(null)}
              className={`text-[11px] font-sans px-2 py-1 border transition-colors ${
                selectedPositionId === null
                  ? 'border-authority text-authority bg-authority/5'
                  : 'border-rule text-ink-soft hover:border-ink'
              }`}
            >
              None
            </button>
            {(positions ?? []).map((pos) => (
              <button
                key={pos.id}
                type="button"
                onClick={() => setSelectedPositionId(pos.id)}
                className={`text-[11px] font-sans px-2 py-1 border transition-colors ${
                  selectedPositionId === pos.id
                    ? 'border-authority text-authority bg-authority/5'
                    : 'border-rule text-ink-soft hover:border-ink'
                }`}
              >
                {pos.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onClose}
          disabled={addMember.isPending}
          className="px-3 py-1 text-[11px] font-sans text-ink-soft hover:text-ink transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!selectedUnitId || addMember.isPending}
          onClick={handleAdd}
          className="px-3 py-1 text-[11px] font-sans font-medium bg-authority text-paper-raised hover:bg-authority-soft transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {addMember.isPending ? 'Adding…' : 'Add'}
        </button>
      </div>
    </div>
  );
}
