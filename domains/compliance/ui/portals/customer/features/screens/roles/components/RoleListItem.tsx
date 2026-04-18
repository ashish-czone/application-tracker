import { Shield } from 'lucide-react';
import { PERMISSION_REGISTRY, type Role } from '../data/rolesMock';

export interface RoleListItemProps {
  role: Role;
  isSelected: boolean;
  onSelect: () => void;
}

export function RoleListItem({ role, isSelected, onSelect }: RoleListItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left px-4 py-3 border-b border-rule transition-colors group ${
        isSelected ? 'bg-ink text-paper' : 'hover:bg-paper-sunken/40'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Shield
            className={`w-3.5 h-3.5 flex-none ${
              isSelected ? 'text-paper/70' : 'text-ink-muted'
            }`}
            strokeWidth={1.5}
          />
          <span
            className={`text-sm font-sans font-medium truncate ${
              isSelected ? 'text-paper' : 'text-ink'
            }`}
          >
            {role.name}
          </span>
          {role.isSystem && (
            <span
              className={`text-[9px] uppercase tracking-eyebrow font-sans font-semibold px-1.5 py-0.5 ${
                isSelected ? 'bg-paper/15 text-paper/80' : 'bg-authority/10 text-authority'
              }`}
            >
              System
            </span>
          )}
          {role.isDefault && (
            <span
              className={`text-[9px] uppercase tracking-eyebrow font-sans font-semibold px-1.5 py-0.5 ${
                isSelected ? 'bg-paper/15 text-paper/80' : 'bg-filed/10 text-filed'
              }`}
            >
              Default
            </span>
          )}
        </div>
        <span
          className={`font-mono text-[11px] tabular-nums flex-none ${
            isSelected ? 'text-paper/60' : 'text-ink-muted'
          }`}
        >
          {role.userCount}
        </span>
      </div>
      <div
        className={`mt-0.5 text-[10px] font-sans ${
          isSelected ? 'text-paper/50' : 'text-ink-muted'
        }`}
      >
        {role.permissions.length} of {PERMISSION_REGISTRY.length} permissions
      </div>
    </button>
  );
}
