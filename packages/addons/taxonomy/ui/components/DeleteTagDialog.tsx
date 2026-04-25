import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from '@packages/ui';
import { useDeleteTag } from '../hooks';
import type { Tag } from '../types';

interface DeleteTagDialogProps {
  tag: Tag | null;
  onClose: () => void;
}

export function DeleteTagDialog({ tag, onClose }: DeleteTagDialogProps) {
  const deleteMutation = useDeleteTag({ onSuccess: onClose });

  return (
    <Dialog open={!!tag} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete tag</DialogTitle>
          <DialogDescription>
            This will permanently delete the "{tag?.name}" tag. It must not be attached to any entities before it can be deleted.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={deleteMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => tag && deleteMutation.mutate(tag.id)}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete tag'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
