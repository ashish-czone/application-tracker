import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
} from '@packages/ui';

interface SessionExpiredModalProps {
  isOpen: boolean;
  onLogin: () => void;
}

export function SessionExpiredModal({ isOpen, onLogin }: SessionExpiredModalProps) {
  return (
    <Dialog open={isOpen}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Session expired</DialogTitle>
          <DialogDescription>
            Your session has expired. Please log in again to continue. You can copy any unsaved work
            before navigating away.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onLogin}>Log in</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
