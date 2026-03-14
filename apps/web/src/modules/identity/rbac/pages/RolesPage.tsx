import { useState } from 'react';
import { Shield, Plus } from 'lucide-react';
import { Button } from '@packages/ui';
import { Can } from '../../auth/components/Can';
import { useRoles } from '../hooks/useRoles';
import { useCreateRole, useUpdateRole, useDeleteRole } from '../hooks/useRoleMutations';
import { RolesTable } from '../components/RolesTable';
import { RoleFormDialog } from '../components/RoleFormDialog';
import { RolePermissionsDialog } from '../components/RolePermissionsDialog';
import { DeleteRoleDialog } from '../components/DeleteRoleDialog';
import type { Role, CreateRoleInput, UpdateRoleInput } from '../types';

export function RolesPage() {
  const { data: roles, isLoading, error } = useRoles();

  const createMutation = useCreateRole();
  const updateMutation = useUpdateRole();
  const deleteMutation = useDeleteRole();

  const [formOpen, setFormOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const handleCreate = () => {
    setSelectedRole(null);
    setFormOpen(true);
  };

  const handleEdit = (role: Role) => {
    setSelectedRole(role);
    setFormOpen(true);
  };

  const handleManagePermissions = (role: Role) => {
    setSelectedRole(role);
    setPermissionsOpen(true);
  };

  const handleDeleteClick = (role: Role) => {
    setSelectedRole(role);
    setDeleteOpen(true);
  };

  const handleFormSubmit = (values: CreateRoleInput | UpdateRoleInput) => {
    if (selectedRole) {
      updateMutation.mutate(
        { id: selectedRole.id, data: values },
        { onSuccess: () => setFormOpen(false) },
      );
    } else {
      createMutation.mutate(values as CreateRoleInput, {
        onSuccess: () => setFormOpen(false),
      });
    }
  };

  const handleDeleteConfirm = () => {
    if (!selectedRole) return;
    deleteMutation.mutate(selectedRole.id, {
      onSuccess: () => setDeleteOpen(false),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl">
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
          <p className="text-sm text-destructive">
            Failed to load roles. You may not have permission to view this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground">Manage roles and their permissions.</p>
        <Can permission="rbac.roles.manage">
          <Button size="sm" onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            Create Role
          </Button>
        </Can>
      </div>

      {roles && roles.length === 0 ? (
        <div className="bg-white rounded-xl border border-border/60 p-12 text-center">
          <Shield className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">No roles yet</p>
          <p className="text-sm text-muted-foreground mb-4">Create a role to start managing permissions.</p>
          <Can permission="rbac.roles.manage">
            <Button size="sm" onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-1.5" />
              Create Role
            </Button>
          </Can>
        </div>
      ) : (
        <RolesTable
          roles={roles ?? []}
          onEdit={handleEdit}
          onManagePermissions={handleManagePermissions}
          onDelete={handleDeleteClick}
        />
      )}

      <RoleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        role={selectedRole}
        onSubmit={handleFormSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      <RolePermissionsDialog
        open={permissionsOpen}
        onOpenChange={setPermissionsOpen}
        role={selectedRole}
      />

      <DeleteRoleDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        role={selectedRole}
        onConfirm={handleDeleteConfirm}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}
