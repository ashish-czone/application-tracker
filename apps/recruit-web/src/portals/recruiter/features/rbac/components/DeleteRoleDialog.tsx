import { useEffect, useState } from 'react';
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
import { getRoleUserCount } from '../services';
import { useDeleteRole } from '../hooks';
import type { Role } from '../types';

interface DeleteRoleDialogProps {
  role: Role | null;
  onClose: () => void;
}

export function DeleteRoleDialog({ role, onClose }: DeleteRoleDialogProps) {
  const [userCount, setUserCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const deleteMutation = useDeleteRole({ onSuccess: onClose });

  useEffect(() => {
    if (!role) {
      setUserCount(null);
      return;
    }
    setLoading(true);
    getRoleUserCount(role.id)
      .then((res) => setUserCount(res.count))
      .catch(() => setUserCount(null))
      .finally(() => setLoading(false));
  }, [role]);

  const hasUsers = userCount !== null && userCount > 0;
  const canDelete = !loading && !hasUsers;

  return (
    <Dialog open={!!role} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete role</DialogTitle>
          <DialogDescription>
            {loading ? (
              <Skeleton className="h-4 w-full" />
            ) : hasUsers ? (
              <>
                <span className="font-medium text-destructive">{userCount} user{userCount !== 1 ? 's' : ''}</span>{' '}
                {userCount === 1 ? 'is' : 'are'} currently assigned to the "{role?.name}" role.
                You need to reassign {userCount === 1 ? 'this user' : 'these users'} to a different role before deleting.
              </>
            ) : (
              <>
                This will permanently delete the "{role?.name}" role and remove all its permission assignments.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={deleteMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => role && deleteMutation.mutate(role.id)}
            disabled={!canDelete || deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete role'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
