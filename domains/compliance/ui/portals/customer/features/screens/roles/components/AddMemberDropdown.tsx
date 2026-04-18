import { useState } from 'react';
import { X } from 'lucide-react';
import { AvatarBadge, SearchInput } from '@packages/ui';
import { getAvailableMembers, type RoleMember } from '../data/rolesMock';

export interface AddMemberDropdownProps {
  roleId: string;
  onAdd: (member: RoleMember) => void;
  onClose: () => void;
}

export function AddMemberDropdown({ roleId, onAdd, onClose }: AddMemberDropdownProps) {
  const [query, setQuery] = useState('');
  const available = getAvailableMembers(roleId);
  const filtered = query
    ? available.filter(
        (m) =>
          m.name.toLowerCase().includes(query.toLowerCase()) ||
          m.email.toLowerCase().includes(query.toLowerCase()),
      )
    : available;

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
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-ink-muted font-sans">
            {available.length === 0 ? 'All users assigned' : 'No matches'}
          </div>
        ) : (
          filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                onAdd(m);
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-paper-sunken/40 transition-colors text-left"
            >
              <AvatarBadge initials={m.initials} size="sm" />
              <div className="min-w-0">
                <div className="text-sm font-sans text-ink truncate">{m.name}</div>
                <div className="text-[10px] text-ink-muted font-sans truncate">{m.email}</div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
