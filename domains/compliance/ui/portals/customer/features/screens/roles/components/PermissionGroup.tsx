import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Checkbox } from '@packages/ui';

import type { PermissionItem } from '../utils/permissions';

export interface PermissionGroupProps {
  module: string;
  permissions: PermissionItem[];
  enabledPermissions: Set<string>;
  onToggle: (name: string) => void;
  onToggleAll: (module: string, names: string[], checked: boolean) => void;
  isSystemRole: boolean;
  search: string;
}

export function PermissionGroup({
  module,
  permissions,
  enabledPermissions,
  onToggle,
  onToggleAll,
  isSystemRole,
  search,
}: PermissionGroupProps) {
  const [expanded, setExpanded] = useState(true);

  const filtered = search
    ? permissions.filter(
        (p) =>
          p.label.toLowerCase().includes(search) || p.name.toLowerCase().includes(search),
      )
    : permissions;

  if (filtered.length === 0) return null;

  const enabledCount = filtered.filter((p) => enabledPermissions.has(p.name)).length;
  const allChecked = enabledCount === filtered.length;
  const someChecked = enabledCount > 0 && !allChecked;
  const groupCheckState = allChecked
    ? true
    : someChecked
      ? ('indeterminate' as const)
      : false;

  return (
    <div className="border border-rule">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-paper-raised hover:bg-paper-sunken/30 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-ink-muted flex-none" strokeWidth={1.5} />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-ink-muted flex-none" strokeWidth={1.5} />
        )}
        <Checkbox
          checked={groupCheckState}
          disabled={isSystemRole}
          onCheckedChange={(checked) => {
            onToggleAll(
              module,
              filtered.map((p) => p.name),
              !!checked,
            );
          }}
          onClick={(e) => e.stopPropagation()}
          className="border-rule data-[state=checked]:bg-ink data-[state=checked]:border-ink data-[state=indeterminate]:bg-ink data-[state=indeterminate]:border-ink"
        />
        <span className="flex-1 text-left text-sm font-sans font-medium text-ink">{module}</span>
        <span className="font-mono text-[11px] tabular-nums text-ink-muted">
          {enabledCount} of {filtered.length}
        </span>
      </button>
      {expanded && (
        <div className="px-4 py-2 border-t border-rule bg-paper">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5">
            {filtered.map((p) => (
              <label
                key={p.name}
                className={`flex items-center gap-2.5 py-1.5 ${
                  isSystemRole ? 'cursor-not-allowed opacity-60' : 'cursor-pointer group'
                }`}
              >
                <Checkbox
                  checked={enabledPermissions.has(p.name)}
                  disabled={isSystemRole}
                  onCheckedChange={() => onToggle(p.name)}
                  className="border-rule data-[state=checked]:bg-ink data-[state=checked]:border-ink"
                />
                <span className="text-[13px] font-sans text-ink group-hover:text-ink/80">
                  {p.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
