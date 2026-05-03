import { useMemo, useState } from 'react';
import { X, Shield } from 'lucide-react';
import { SearchInput, toast } from '@packages/ui';
import { useRoleOptions, useAddRoleMember } from '@packages/rbac-ui';
import { useOrgPositions } from '@packages/org-units-ui';
import { useQueryClient } from '@tanstack/react-query';
import { useDebouncedValue } from '../../../../../hooks/useDebouncedValue';
import type { UserPosition } from '../types';

// Compliance-seeded roles whose capability is team- or firm-level leadership.
// Matching by display name is intentionally soft — admins can rename roles,
// at which point the advisory stops firing. The assignment is never blocked.
const LEADERSHIP_ROLE_NAMES = new Set(['Team Lead', 'Firm Admin']);

export interface RoleAssignEditorProps {
  userId: string;
  /** IDs of roles the user already has — excluded from the picker. */
  excludeRoleIds: string[];
  /** Positions currently held by the user — used to flag role/position tier mismatches. */
  userPositions: UserPosition[];
  onClose: () => void;
}

export function RoleAssignEditor({ userId, excludeRoleIds, userPositions, onClose }: RoleAssignEditorProps) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const queryClient = useQueryClient();
  // Server-driven typeahead — ILIKE on role.name. We don't pass `userType`
  // because the picker accepts both audience-agnostic (`userType === null`)
  // and client-audience roles, but the backend's userType filter is narrow
  // (single value). The dataset is server-clamped to 25 rows, so the audience
  // filter runs client-side on a bounded result set — not a data-fetching
  // violation (the search itself is server-side).
  const { data: roleOptions, isLoading } = useRoleOptions({
    search: debouncedQuery || undefined,
  });
  const { data: positions } = useOrgPositions();

  const addMember = useAddRoleMember();

  const excluded = useMemo(() => new Set(excludeRoleIds), [excludeRoleIds]);
  const filtered = useMemo(() => {
    return (roleOptions ?? [])
      .filter((r) => r.userType === 'client' || r.userType === null)
      .filter((r) => !excluded.has(r.id));
  }, [roleOptions, excluded]);

  // A position is leadership-tier when its sortOrder is 0 or lower (Head /
  // Division Head / Firm Admin in the compliance seed — see Q14). Derived
  // from live position data so admin renames are respected.
  const userHasLeadershipPosition = useMemo(() => {
    if (!positions) return false;
    const leadershipNames = new Set(
      positions.filter((p) => p.sortOrder <= 0).map((p) => p.name),
    );
    return userPositions.some((p) => leadershipNames.has(p.title));
  }, [positions, userPositions]);

  const handleAdd = (role: { id: string; name: string }) => {
    if (LEADERSHIP_ROLE_NAMES.has(role.name) && !userHasLeadershipPosition) {
      toast.warning(
        `"${role.name}" is a leadership-tier role, but this user has no leadership-tier position (Head / Division Head / Firm Admin). The assignment is allowed — check that the role's scope grants match what you intend.`,
      );
    }
    addMember.mutate(
      { roleId: role.id, userId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['users'] });
          onClose();
        },
      },
    );
  };

  return (
    <div className="border border-rule bg-paper-raised">
      <div className="flex items-center justify-between px-3 py-2 border-b border-rule">
        <span className="text-[10px] uppercase tracking-eyebrow font-sans font-medium text-ink-muted">
          Assign role
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
        <SearchInput
          variant="bare"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search roles…"
        />
      </div>
      <div className="max-h-48 overflow-y-auto">
        {isLoading ? (
          <div className="px-3 py-4 text-sm font-serif italic text-ink-muted text-center">
            Loading roles…
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-4 text-sm font-serif italic text-ink-muted text-center">
            {query ? 'No roles match.' : 'No roles available to assign.'}
          </div>
        ) : (
          filtered.map((role) => (
            <button
              key={role.id}
              type="button"
              disabled={addMember.isPending}
              onClick={() => handleAdd(role)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-paper-sunken/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Shield className="w-3 h-3 text-authority flex-none" strokeWidth={1.5} />
              <span className="text-sm font-sans text-ink">{role.name}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
