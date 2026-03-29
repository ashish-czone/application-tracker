import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from '@packages/ui';
import { useRolePermissions, useSetRolePermissions } from '../hooks';
import { PermissionsPicker } from './PermissionsPicker';
import { FieldPermissionsTab } from './FieldPermissionsTab';
import type { Role, PermissionEntry, ScopedPermissions } from '../types';

type Tab = 'permissions' | 'fields';

interface PermissionsModalProps {
  role: Role | null;
  onClose: () => void;
}

export function PermissionsModal({ role, onClose }: PermissionsModalProps) {
  const [tab, setTab] = useState<Tab>('permissions');
  const { data: currentPermissions, isLoading } = useRolePermissions(role?.id ?? null);
  const setPermissionsMutation = useSetRolePermissions({ onSuccess: onClose });

  const [selected, setSelected] = useState<ScopedPermissions>({});

  useEffect(() => {
    if (currentPermissions) {
      setSelected({ ...currentPermissions });
    }
  }, [currentPermissions]);

  // Reset tab when role changes
  useEffect(() => {
    setTab('permissions');
  }, [role?.id]);

  function handleSave() {
    if (!role) return;
    const permissions: PermissionEntry[] = Object.entries(selected).map(([name, scope]) => ({
      name,
      scope,
    }));
    setPermissionsMutation.mutate({ roleId: role.id, permissions });
  }

  return (
    <Dialog open={!!role} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Role Settings — {role?.name}</DialogTitle>
          <DialogDescription>
            Manage permissions and field access
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="border-b -mx-6 px-6">
          <nav className="flex gap-0 -mb-px">
            {([
              { key: 'permissions', label: 'Permissions' },
              { key: 'fields', label: 'Field Permissions' },
            ] as { key: Tab; label: string }[]).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto py-2">
          {tab === 'permissions' && (
            <PermissionsPicker selected={selected} onChange={setSelected} disabled={role?.isSystem} />
          )}
          {tab === 'fields' && role && (
            <FieldPermissionsTab roleId={role.id} />
          )}
        </div>

        {/* Footer — only show for permissions tab and non-system roles (field tab has its own save) */}
        {tab === 'permissions' && !role?.isSystem && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={setPermissionsMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={setPermissionsMutation.isPending || isLoading}>
              {setPermissionsMutation.isPending ? 'Saving...' : 'Save permissions'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
