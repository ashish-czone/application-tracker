import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@packages/ui';

interface LevelsSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function LevelsSettingsDialog({ open, onClose }: LevelsSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hierarchy Levels</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Levels settings coming next.</p>
      </DialogContent>
    </Dialog>
  );
}
