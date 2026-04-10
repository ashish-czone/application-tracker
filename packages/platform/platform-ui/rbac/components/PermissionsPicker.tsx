import { useMemo } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Skeleton } from '@packages/ui';
import { usePermissionRegistry } from '../hooks';
import type { BooleanPermissions } from '../types';

interface PermissionsPickerProps {
  selected: BooleanPermissions;
  onChange: (selected: BooleanPermissions) => void;
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
      next[permName] = true;
    }
    onChange(next);
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
        <div className="rounded-md bg-muted/50 border border-border px-3 py-3 space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
            System role — full access granted
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed pl-6">
            This is a system-managed role with unrestricted access to all permissions. Its permissions cannot be modified.
            To create a role with specific permissions, add a new role instead.
          </p>
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
              const isDisabled = disabled || hasWildcard;
              return (
                <div
                  key={permName}
                  className={`flex items-center rounded-md px-3 py-2 ${isDisabled ? 'opacity-60' : 'hover:bg-muted/50'}`}
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
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
