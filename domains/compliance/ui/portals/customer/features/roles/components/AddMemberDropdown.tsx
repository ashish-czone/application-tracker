import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { AvatarBadge, SearchInput } from '@packages/ui';
import { useUsers } from '@packages/users-ui';
import { useDebouncedValue } from '../../../../../hooks/useDebouncedValue';

export interface AddMemberDropdownProps {
  excludedUserIds: Set<string>;
  onAdd: (userId: string) => void;
  onClose: () => void;
  disabled?: boolean;
}

export function AddMemberDropdown({
  excludedUserIds,
  onAdd,
  onClose,
  disabled,
}: AddMemberDropdownProps) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  // Server-driven typeahead — `useUsers` ILIKEs first/last/email when
  // `search` is set. Default page size is 25 server-side, which is plenty
  // for a typeahead dropdown; users narrow further by typing. The previous
  // `limit: 100` was a data-fetching.md violation: it raised the implicit
  // ceiling without actually solving "find a specific user to add".
  const { data: users, isLoading } = useUsers({
    search: debouncedQuery || undefined,
  });

  const available = useMemo(() => {
    const list = users?.data ?? [];
    return list.filter((u) => !excludedUserIds.has(u.id));
  }, [users, excludedUserIds]);

  return (
    <div className="absolute right-0 top-full mt-1 z-20 w-72 border border-rule bg-paper-raised shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-rule">
        <SearchInput
          variant="bare"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search users..."
          autoFocus
          wrapperClassName="flex-1"
        />
        <button type="button" onClick={onClose} className="text-ink-muted hover:text-ink">
          <X className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {isLoading ? (
          <div className="px-3 py-4 text-center text-sm text-ink-muted font-sans">Loading…</div>
        ) : available.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-ink-muted font-sans">
            {query ? 'No matches' : 'No users available'}
          </div>
        ) : (
          available.map((u) => {
            const fullName = `${u.firstName} ${u.lastName}`.trim();
            const initials = `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase();
            return (
              <button
                key={u.id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onAdd(u.id);
                  onClose();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-paper-sunken/40 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <AvatarBadge initials={initials} size="sm" />
                <div className="min-w-0">
                  <div className="text-sm font-sans text-ink truncate">{fullName}</div>
                  <div className="text-[10px] text-ink-muted font-sans truncate">{u.email}</div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
