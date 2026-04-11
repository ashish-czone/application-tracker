import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@packages/ui';
import type { OrgUnit } from '../types';

interface MembersDialogProps {
  unit: OrgUnit | null;
  onClose: () => void;
}

export function MembersDialog({ unit, onClose }: MembersDialogProps) {
  return (
    <Dialog open={!!unit} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Members — {unit?.name}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Member management coming next.</p>
      </DialogContent>
    </Dialog>
  );
}
