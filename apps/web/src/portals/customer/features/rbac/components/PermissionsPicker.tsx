import { useMemo } from 'react';
import { Skeleton } from '@packages/ui';
import { usePermissionRegistry } from '../hooks';
import type { ScopedPermissions } from '../types';

interface PermissionsPickerProps {
  selected: ScopedPermissions;
  onChange: (selected: ScopedPermissions) => void;
}

export function PermissionsPicker({ selected, onChange }: PermissionsPickerProps) {
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
      {Object.entries(grouped).map(([module, perms]) => (
        <div key={module}>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {module}
          </h4>
          <div className="space-y-1">
            {perms.map(({ permName, action, description }) => {
              const isChecked = permName in selected;
              const scope = selected[permName];
              return (
                <div
                  key={permName}
                  className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted/50"
                >
                  <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => togglePermission(permName)}
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
