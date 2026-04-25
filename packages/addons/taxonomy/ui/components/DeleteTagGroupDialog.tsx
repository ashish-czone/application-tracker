import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from '@packages/ui';
import { useDeleteTagGroup } from '../hooks';
import type { TagGroup } from '../types';

interface DeleteTagGroupDialogProps {
  tagGroup: TagGroup | null;
  onClose: () => void;
}

export function DeleteTagGroupDialog({ tagGroup, onClose }: DeleteTagGroupDialogProps) {
  const deleteMutation = useDeleteTagGroup({ onSuccess: onClose });

  return (
    <Dialog open={!!tagGroup} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete tag group</DialogTitle>
          <DialogDescription>
            This will permanently delete the "{tagGroup?.name}" group. The group must have no tags assigned before it can be deleted.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={deleteMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => tagGroup && deleteMutation.mutate(tagGroup.id)}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete group'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
