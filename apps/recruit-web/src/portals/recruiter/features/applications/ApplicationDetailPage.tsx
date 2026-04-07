import { useState } from 'react';
import { useParams } from 'react-router';
import { CalendarPlus } from 'lucide-react';
import { Button } from '@packages/ui';
import { EntityDetailPage, useEntityHooks } from '@packages/entity-engine-ui';
import { AuditTimeline } from '@packages/platform-ui/audit';
import { NotesSection } from '@packages/notes-ui';
import { AttachmentsSection } from '@packages/attachments-ui';
import { ScheduleInterviewDialog } from '../shared/ScheduleInterviewDialog';

function renderAuditTrail(entityType: string, entityId: string) {
  return <AuditTimeline entityType={entityType} entityId={entityId} />;
}

function renderNotes(entityType: string, entityId: string) {
  return <NotesSection entityType={entityType} entityId={entityId} />;
}

function renderAttachments(entityType: string, entityId: string) {
  return <AttachmentsSection entityType={entityType} entityId={entityId} />;
}

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
        renderAuditTrail={renderAuditTrail}
        renderNotes={renderNotes}
        renderAttachments={renderAttachments}
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
