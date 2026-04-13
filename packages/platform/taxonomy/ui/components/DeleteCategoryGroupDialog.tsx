import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from '@packages/ui';
import { useDeleteCategoryGroup } from '../hooks';
import type { CategoryGroup } from '../types';

interface DeleteCategoryGroupDialogProps {
  categoryGroup: CategoryGroup | null;
  onClose: () => void;
}

export function DeleteCategoryGroupDialog({ categoryGroup, onClose }: DeleteCategoryGroupDialogProps) {
  const deleteMutation = useDeleteCategoryGroup({ onSuccess: onClose });

  return (
    <Dialog open={!!categoryGroup} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete category group</DialogTitle>
          <DialogDescription>
            This will permanently delete the "{categoryGroup?.name}" group. The group must have no categories before it can be deleted.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={deleteMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => categoryGroup && deleteMutation.mutate(categoryGroup.id)}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete group'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
