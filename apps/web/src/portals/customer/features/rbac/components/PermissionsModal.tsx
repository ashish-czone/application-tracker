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
import type { Role, PermissionEntry, ScopedPermissions } from '../types';

interface PermissionsModalProps {
  role: Role | null;
  onClose: () => void;
}

export function PermissionsModal({ role, onClose }: PermissionsModalProps) {
  const { data: currentPermissions, isLoading } = useRolePermissions(role?.id ?? null);
  const setPermissionsMutation = useSetRolePermissions({ onSuccess: onClose });

  const [selected, setSelected] = useState<ScopedPermissions>({});

  useEffect(() => {
    if (currentPermissions) {
      setSelected({ ...currentPermissions });
    }
  }, [currentPermissions]);

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
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Permissions</DialogTitle>
          <DialogDescription>
            Manage permissions for "{role?.name}"
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2">
          <PermissionsPicker selected={selected} onChange={setSelected} />
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
