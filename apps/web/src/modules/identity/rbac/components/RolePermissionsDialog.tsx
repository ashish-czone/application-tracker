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
import { usePermissions } from '../hooks/usePermissions';
import { useRolePermissions, useSetRolePermissions } from '../hooks/useRolePermissions';
import type { Role } from '../types';

interface RolePermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role | null;
}

export function RolePermissionsDialog({ open, onOpenChange, role }: RolePermissionsDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: allPermissions, isLoading: loadingPermissions } = usePermissions();
  const { data: rolePermissions, isLoading: loadingRolePerms } = useRolePermissions(role?.id ?? '');
  const setPermissionsMutation = useSetRolePermissions();

  const isLoading = loadingPermissions || loadingRolePerms;

  useEffect(() => {
    if (rolePermissions) {
      setSelectedIds(new Set(rolePermissions.map((rp) => rp.permissionId)));
    }
  }, [rolePermissions]);

  const togglePermission = (permissionId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(permissionId)) {
        next.delete(permissionId);
      } else {
        next.add(permissionId);
      }
      return next;
    });
  };

  const handleSave = () => {
    if (!role) return;
    setPermissionsMutation.mutate(
      { roleId: role.id, permissionIds: Array.from(selectedIds) },
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  };

  // Group permissions by resource
  const grouped = (allPermissions ?? []).reduce<Record<string, typeof allPermissions>>(
    (acc, perm) => {
      const resource = perm.resource;
      if (!acc[resource]) acc[resource] = [];
      acc[resource]!.push(perm);
      return acc;
    },
    {},
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Permissions</DialogTitle>
          <DialogDescription>
            Select permissions for <span className="font-medium text-foreground">{role?.name}</span>.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
            {Object.entries(grouped).map(([resource, permissions]) => (
              <div key={resource}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {resource}
                </p>
                <div className="space-y-1.5">
                  {permissions!.map((perm) => (
                    <label
                      key={perm.id}
                      className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 hover:bg-muted/40 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(perm.id)}
                        onChange={() => togglePermission(perm.id)}
                        className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                      />
                      <div>
                        <span className="text-sm font-medium text-foreground">{perm.action}</span>
                        {perm.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{perm.description}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            {Object.keys(grouped).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No permissions registered.</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={setPermissionsMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isLoading || setPermissionsMutation.isPending}
          >
            {setPermissionsMutation.isPending ? 'Saving...' : 'Save Permissions'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
