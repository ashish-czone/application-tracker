import { Pencil, Shield, Trash2 } from 'lucide-react';
import { Button } from '@packages/ui';
import type { Role } from '../types';

interface RolesTableProps {
  roles: Role[];
  onEdit: (role: Role) => void;
  onManagePermissions: (role: Role) => void;
  onDelete: (role: Role) => void;
}

export function RolesTable({ roles, onEdit, onManagePermissions, onDelete }: RolesTableProps) {
  return (
    <div className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Name</th>
            <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">
              Description
            </th>
            <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3 w-36">Actions</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => (
            <tr key={role.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3">
                <span className="text-sm font-medium text-foreground">{role.name}</span>
                <p className="text-xs text-muted-foreground mt-0.5 sm:hidden">
                  {role.description || 'No description'}
                </p>
              </td>
              <td className="px-4 py-3 hidden sm:table-cell">
                <span className="text-sm text-muted-foreground">{role.description || '-'}</span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onEdit(role)}
                    title="Edit role"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onManagePermissions(role)}
                    title="Manage permissions"
                  >
                    <Shield className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => onDelete(role)}
                    title="Delete role"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
