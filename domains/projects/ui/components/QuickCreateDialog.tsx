import { useNavigate } from 'react-router';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@packages/ui';
import { EntityQuickCreateForm } from '@packages/entity-engine-ui';

interface QuickCreateDialogProps {
  entityType: string;
  singularName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill values e.g. parent FK. */
  initialValues?: Record<string, unknown>;
  /** Where to navigate after a successful create. Receives the new entity. */
  navigateTo?: (entity: Record<string, unknown>) => string | null;
}

export function QuickCreateDialog({
  entityType,
  singularName,
  open,
  onOpenChange,
  initialValues,
  navigateTo,
}: QuickCreateDialogProps) {
  const navigate = useNavigate();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New {singularName}</DialogTitle>
        </DialogHeader>
        <EntityQuickCreateForm
          entityType={entityType}
          singularName={singularName}
          onClose={() => onOpenChange(false)}
          onSuccess={(entity) => {
            onOpenChange(false);
            const path = navigateTo?.(entity);
            if (path) navigate(path);
          }}
          initialValues={initialValues}
        />
      </DialogContent>
    </Dialog>
  );
}
