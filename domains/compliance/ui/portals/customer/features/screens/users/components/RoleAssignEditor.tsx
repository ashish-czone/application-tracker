import { useMemo, useState } from 'react';
import { X, Shield } from 'lucide-react';
import { SearchInput } from '@packages/ui';
import { useRolesList, useAddRoleMember } from '@packages/rbac-ui';
import { useQueryClient } from '@tanstack/react-query';

export interface RoleAssignEditorProps {
  userId: string;
  /** IDs of roles the user already has — excluded from the picker. */
  excludeRoleIds: string[];
  onClose: () => void;
}

export function RoleAssignEditor({ userId, excludeRoleIds, onClose }: RoleAssignEditorProps) {
  const [query, setQuery] = useState('');
  const queryClient = useQueryClient();
  const { data, isLoading } = useRolesList({ limit: 100 });

  const addMember = useAddRoleMember();

  const excluded = useMemo(() => new Set(excludeRoleIds), [excludeRoleIds]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.data ?? [])
      .filter((r) => r.userType === 'client' || r.userType === null)
      .filter((r) => !excluded.has(r.id))
      .filter((r) => (q ? r.name.toLowerCase().includes(q) : true));
  }, [data, excluded, query]);

  const handleAdd = (roleId: string) => {
    addMember.mutate(
      { roleId, userId },
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
              onClick={() => handleAdd(role.id)}
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
