import { useState, useMemo, useEffect, useCallback } from 'react';
import { Users, Search, Check, ChevronDown } from 'lucide-react';
import { DrawerShell, DrawerHeader, Eyebrow } from '@packages/ui';
import { usePlatformAPI } from '@packages/platform-ui';
import { createUsersApi, type User } from '@packages/users-ui';
import {
  useOrgPositions,
  useOrgUnitMembers,
  useAddOrgUnitMember,
  type OrgUnit,
} from '@packages/org-units-ui';
import { FieldLabel } from '../../../../../components';
import { getInitials } from '../helpers';

export interface AddMemberDrawerProps {
  unit: OrgUnit;
  onClose?: () => void;
}

export function AddMemberDrawer({ unit, onClose }: AddMemberDrawerProps) {
  const apiFn = usePlatformAPI();
  const usersApi = useMemo(() => createUsersApi(apiFn), [apiFn]);

  const { data: members } = useOrgUnitMembers(unit.id);
  const { data: positions } = useOrgPositions();

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [positionId, setPositionId] = useState<string>('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const existingUserIds = useMemo(
    () => new Set((members ?? []).map((m) => m.userId)),
    [members],
  );

  const runSearch = useCallback(
    async (query: string) => {
      setSearching(true);
      try {
        const res = await usersApi.listUsers({
          search: query,
          limit: 20,
          sort: 'firstName',
          order: 'asc',
        });
        setResults(res.data.filter((u) => !existingUserIds.has(u.id)));
      } finally {
        setSearching(false);
      }
    },
    [usersApi, existingUserIds],
  );

  useEffect(() => {
    runSearch(debounced);
  }, [debounced, runSearch]);

  const selectedUser = results.find((u) => u.id === selectedUserId) ?? null;

  const addMutation = useAddOrgUnitMember({ onSuccess: () => onClose?.() });

  function handleSubmit() {
    if (!selectedUserId) return;
    addMutation.mutate({
      unitId: unit.id,
      userId: selectedUserId,
      data: positionId ? { positionId } : undefined,
    });
  }

  const canSubmit = !!selectedUserId && !addMutation.isPending;

  return (
    <DrawerShell onClose={() => onClose?.()} width="md">
      <DrawerHeader
        eyebrow={<Eyebrow tone="muted" mark="§">New Member</Eyebrow>}
        title="Add member"
        subtitle={
          <>
            Assign an existing user to{' '}
            <span className="font-mono not-italic text-ink text-[13px]">{unit.name}</span>
            {' '}and set their position.
          </>
        }
        onClose={() => onClose?.()}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-5 space-y-5">
          <div className="flex items-center gap-2 px-3 py-2 border border-rule bg-paper-sunken/40">
            <Users className="w-3.5 h-3.5 text-ink-muted flex-none" strokeWidth={1.5} />
            <span className="text-[11px] font-sans text-ink-muted">
              Adding to <span className="font-mono font-medium text-ink">{unit.name}</span>
              {' · '}
              <span className="text-ink-muted">{unit.level.name}</span>
            </span>
          </div>

          <FieldRow label="Search users" required>
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-ink-muted flex-none" strokeWidth={1.5} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full bg-transparent outline-none text-sm text-ink font-sans placeholder:text-ink-muted"
              />
            </div>
          </FieldRow>

          <div className="border border-rule bg-paper max-h-64 overflow-y-auto">
            {searching ? (
              <p className="px-3 py-6 text-center text-[11px] font-serif italic text-ink-muted">
                Searching…
              </p>
            ) : results.length === 0 ? (
              <p className="px-3 py-6 text-center text-[11px] font-serif italic text-ink-muted">
                {debounced ? 'No matching users' : 'No users available'}
              </p>
            ) : (
              results.map((u) => {
                const fullName = `${u.firstName} ${u.lastName}`.trim();
                const isSelected = selectedUserId === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedUserId(u.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left border-l-2 transition-colors ${
                      isSelected
                        ? 'border-ink bg-paper-sunken/60'
                        : 'border-transparent hover:bg-paper-sunken/30'
                    }`}
                  >
                    <span className="w-6 h-6 bg-ink-muted text-paper text-[9px] font-sans font-semibold flex items-center justify-center shrink-0">
                      {getInitials(fullName || u.email)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] text-ink font-sans truncate">{fullName || '—'}</span>
                      <span className="block text-[10px] text-ink-muted font-mono truncate">{u.email}</span>
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-ink flex-none" strokeWidth={2} />}
                  </button>
                );
              })
            )}
          </div>

          {selectedUser && (
            <FieldRow label="Position">
              <div className="relative">
                <select
                  value={positionId}
                  onChange={(e) => setPositionId(e.target.value)}
                  className="w-full bg-transparent outline-none text-sm text-ink font-sans appearance-none cursor-pointer pr-6"
                >
                  <option value="">— No position —</option>
                  {(positions ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-muted pointer-events-none" strokeWidth={1.5} />
              </div>
            </FieldRow>
          )}
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
            {addMutation.isPending ? 'Adding…' : 'Add member'}
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
