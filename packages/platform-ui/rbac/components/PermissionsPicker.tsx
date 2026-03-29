import { useMemo } from 'react';
import { Skeleton } from '@packages/ui';
import { usePermissionRegistry } from '../hooks';
import type { ScopedPermissions } from '../types';

interface PermissionsPickerProps {
  selected: ScopedPermissions;
  onChange: (selected: ScopedPermissions) => void;
  disabled?: boolean;
}

export function PermissionsPicker({ selected, onChange, disabled }: PermissionsPickerProps) {
  const hasWildcard = '*' in selected;
  const { data: registry, isLoading } = usePermissionRegistry();

  const grouped = useMemo(() => {
    if (!registry) return {};
    const groups: Record<string, { action: string; description: string; permName: string }[]> = {};
    for (const entry of registry) {
      if (!groups[entry.module]) groups[entry.module] = [];
      groups[entry.module].push({
        action: entry.action,
        description: entry.description,
        permName: `${entry.module}.${entry.action}`,
      });
    }
    return groups;
  }, [registry]);

  function togglePermission(permName: string) {
    const next = { ...selected };
    if (permName in next) {
      delete next[permName];
    } else {
      next[permName] = 'all';
    }
    onChange(next);
  }

  function toggleScope(permName: string) {
    onChange({
      ...selected,
      [permName]: selected[permName] === 'all' ? 'own' : 'all',
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {hasWildcard && (
        <div className="rounded-md bg-muted/50 border border-border px-3 py-2 text-sm text-muted-foreground">
          This role has full access to all permissions.
        </div>
      )}
      {Object.entries(grouped).map(([module, perms]) => (
        <div key={module}>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {module}
          </h4>
          <div className="space-y-1">
            {perms.map(({ permName, action, description }) => {
              const isChecked = hasWildcard || permName in selected;
              const scope = hasWildcard ? 'all' : selected[permName];
              const isDisabled = disabled || hasWildcard;
              return (
                <div
                  key={permName}
                  className={`flex items-center justify-between rounded-md px-3 py-2 ${isDisabled ? 'opacity-60' : 'hover:bg-muted/50'}`}
                >
                  <label className={`flex items-center gap-2.5 flex-1 min-w-0 ${isDisabled ? 'cursor-default' : 'cursor-pointer'}`}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => togglePermission(permName)}
                      disabled={isDisabled}
                      className="rounded border-input shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">{action}</div>
                      <div className="text-xs text-muted-foreground truncate">{description}</div>
                    </div>
                  </label>
                  {isChecked && (
                    <button
                      type="button"
                      onClick={() => toggleScope(permName)}
                      disabled={isDisabled}
                      className="text-xs px-2 py-0.5 rounded border border-input bg-background hover:bg-accent transition-colors shrink-0 ml-2"
                    >
                      {scope === 'all' ? 'All' : 'Own'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
