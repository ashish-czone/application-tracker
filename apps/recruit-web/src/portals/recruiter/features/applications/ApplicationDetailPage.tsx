import { useState } from 'react';
import { useParams } from 'react-router';
import { CalendarPlus } from 'lucide-react';
import { Button } from '@packages/ui';
import { EntityDetailPage, useEntityHooks } from '@packages/entity-engine-ui';
import { ScheduleInterviewDialog } from '../shared/ScheduleInterviewDialog';

export function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const hooks = useEntityHooks('applications');
  const { data: item } = hooks.useDetail(id ?? null);
  const [showSchedule, setShowSchedule] = useState(false);

  const candidateId = item?.candidateId as string | undefined;
  const jobOpeningId = item?.jobOpeningId as string | undefined;
  const canSchedule = !!candidateId && !!jobOpeningId;

  return (
    <>
      <EntityDetailPage
        entityType="applications"
        renderHeaderActions={
          canSchedule
            ? () => (
                <Button size="sm" variant="outline" onClick={() => setShowSchedule(true)}>
                  <CalendarPlus className="h-3.5 w-3.5 mr-1.5" />
                  Schedule Interview
                </Button>
              )
            : undefined
        }
      />

      {showSchedule && candidateId && jobOpeningId && (
        <ScheduleInterviewDialog
          open={showSchedule}
          onOpenChange={setShowSchedule}
          candidateId={candidateId}
          jobOpeningId={jobOpeningId}
          onSuccess={() => setShowSchedule(false)}
        />
      )}
    </>
  );
}
