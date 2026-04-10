import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from '@packages/ui';
import { useDeleteCategory } from '../hooks';
import type { Category } from '../types';

interface DeleteCategoryDialogProps {
  category: Category | null;
  onClose: () => void;
}

export function DeleteCategoryDialog({ category, onClose }: DeleteCategoryDialogProps) {
  const deleteMutation = useDeleteCategory({ onSuccess: onClose });

  return (
    <Dialog open={!!category} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete category</DialogTitle>
          <DialogDescription>
            This will permanently delete the "{category?.name}" category. It must have no child categories before it can be deleted.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={deleteMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => category && deleteMutation.mutate(category.id)}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete category'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
