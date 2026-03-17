import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Skeleton,
} from '@packages/ui';
import { useRolePermissions, useSetRolePermissions, usePermissionRegistry } from '../hooks';
import type { Role, PermissionEntry, ScopedPermissions } from '../types';

interface PermissionsModalProps {
  role: Role | null;
  onClose: () => void;
}

export function PermissionsModal({ role, onClose }: PermissionsModalProps) {
  const { data: registry, isLoading: registryLoading } = usePermissionRegistry();
  const { data: currentPermissions, isLoading: permissionsLoading } = useRolePermissions(role?.id ?? null);
  const setPermissionsMutation = useSetRolePermissions({ onSuccess: onClose });

  // Local state for editing — initialized from currentPermissions
  const [selected, setSelected] = useState<ScopedPermissions>({});

  useEffect(() => {
    if (currentPermissions) {
      setSelected({ ...currentPermissions });
    }
  }, [currentPermissions]);

  // Group registry entries by module
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
    setSelected((prev) => {
      const next = { ...prev };
      if (permName in next) {
        delete next[permName];
      } else {
        next[permName] = 'all';
      }
      return next;
    });
  }

  function toggleScope(permName: string) {
    setSelected((prev) => ({
      ...prev,
      [permName]: prev[permName] === 'all' ? 'own' : 'all',
    }));
  }

  function handleSave() {
    if (!role) return;
    const permissions: PermissionEntry[] = Object.entries(selected).map(([name, scope]) => ({
      name,
      scope,
    }));
    setPermissionsMutation.mutate({ roleId: role.id, permissions });
  }

  const isLoading = registryLoading || permissionsLoading;

  return (
    <Dialog open={!!role} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Permissions</DialogTitle>
          <DialogDescription>
            Manage permissions for "{role?.name}"
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 py-2">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))
          ) : (
            Object.entries(grouped).map(([module, perms]) => (
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
            ))
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={setPermissionsMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={setPermissionsMutation.isPending || isLoading}>
            {setPermissionsMutation.isPending ? 'Saving...' : 'Save permissions'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
