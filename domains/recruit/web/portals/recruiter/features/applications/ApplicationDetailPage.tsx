import { useState } from 'react';
import { useParams, Link } from 'react-router';
import { CalendarPlus, FileSignature } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@packages/ui';
import { EntityDetailPage, useEntityHooks, useEntityEngine } from '@packages/entity-engine-ui';
import { ScheduleInterviewDialog } from '@domains/recruit-web/portals/recruiter/features/shared/ScheduleInterviewDialog';
import { CreateOfferDialog } from '@domains/recruit-web/portals/recruiter/features/shared/CreateOfferDialog';

export function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const hooks = useEntityHooks('applications');
  const { apiFn } = useEntityEngine();
  const { data: item } = hooks.useDetail(id ?? null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showCreateOffer, setShowCreateOffer] = useState(false);

  const candidateId = item?.candidateId as string | undefined;
  const jobOpeningId = item?.jobOpeningId as string | undefined;
  const canSchedule = !!candidateId && !!jobOpeningId;
  const stage = item?.stage as string | undefined;

  // Check if an offer already exists for this application
  const { data: existingOffer } = useQuery({
    queryKey: ['applications', id, 'offer'],
    queryFn: () => apiFn.get<{ data: { id: string; status: string }[] }>(`/offers?applicationId=${id}&limit=1`),
    enabled: !!id && stage === 'offer',
  });
  const offer = existingOffer?.data?.[0];
  const showOfferButton = stage === 'offer' && !offer;

  return (
    <>
      <EntityDetailPage
        entityType="applications"
        renderHeaderActions={
          (canSchedule || showOfferButton || offer)
            ? () => (
                <div className="flex items-center gap-2">
                  {offer && (
                    <Link to={`/offers/${offer.id}`}>
                      <Button size="sm" variant="outline">
                        <FileSignature className="h-3.5 w-3.5 mr-1.5" />
                        View Offer ({offer.status.replace(/[-_]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())})
                      </Button>
                    </Link>
                  )}
                  {showOfferButton && (
                    <Button size="sm" onClick={() => setShowCreateOffer(true)}>
                      <FileSignature className="h-3.5 w-3.5 mr-1.5" />
                      Create Offer
                    </Button>
                  )}
                  {canSchedule && (
                    <Button size="sm" variant="outline" onClick={() => setShowSchedule(true)}>
                      <CalendarPlus className="h-3.5 w-3.5 mr-1.5" />
                      Schedule Interview
                    </Button>
                  )}
                </div>
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

      {showCreateOffer && id && (
        <CreateOfferDialog
          open={showCreateOffer}
          onOpenChange={setShowCreateOffer}
          applicationId={id}
          onSuccess={() => setShowCreateOffer(false)}
        />
      )}
    </>
  );
}
