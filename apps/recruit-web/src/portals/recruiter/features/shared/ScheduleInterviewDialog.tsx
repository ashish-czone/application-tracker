import { useMemo } from 'react';
import { Dialog, DialogContent } from '@packages/ui';
import { EntityQuickCreateForm } from '@packages/entity-engine-ui';

interface ScheduleInterviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  jobOpeningId: string;
  onSuccess?: (entity: Record<string, unknown>) => void;
}

export function ScheduleInterviewDialog({
  open,
  onOpenChange,
  candidateId,
  jobOpeningId,
  onSuccess,
}: ScheduleInterviewDialogProps) {
  const initialValues = useMemo(
    () => ({ candidateId, jobOpeningId }),
    [candidateId, jobOpeningId],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <EntityQuickCreateForm
          entityType="interviews"
          singularName="Interview"
          initialValues={initialValues}
          onClose={() => onOpenChange(false)}
          onSuccess={onSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}
