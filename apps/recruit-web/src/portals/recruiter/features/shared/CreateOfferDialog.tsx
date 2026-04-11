import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@packages/ui';
import { EntityQuickCreateForm } from '@packages/entity-engine-ui';

interface CreateOfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  onSuccess?: (entity: Record<string, unknown>) => void;
}

export function CreateOfferDialog({
  open,
  onOpenChange,
  applicationId,
  onSuccess,
}: CreateOfferDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Offer</DialogTitle>
        </DialogHeader>
        <EntityQuickCreateForm
          entityType="offers"
          singularName="Offer"
          initialValues={{ applicationId }}
          onSuccess={(entity) => {
            onOpenChange(false);
            onSuccess?.(entity);
          }}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
