import { useCallback, useMemo } from 'react';
import { Link } from 'react-router';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import {
  ExternalLink, CalendarPlus, ClipboardCheck, FileSignature,
  AlertCircle, Clock4, CheckCircle2, XCircle,
} from 'lucide-react';
import {
  Button, cn,
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@packages/ui';
import { formatLabel } from '@packages/common';
import { DynamicSection } from '@packages/eav-attributes-ui';
import { useEntityEngine, useEntityHooks } from '@packages/entity-engine-ui';
import { useEntityLayout } from '@packages/entity-engine-ui/helpers/useEntityLayout';
import {
  PipelineProgressBar,
  WorkflowTransitionButton,
  TransitionConfirmDialog,
  useWorkflowForEntity,
  useEntityTransition,
} from '@packages/workflows-ui';
import { useState } from 'react';
import { ScheduleInterviewDialog } from '@domains/recruit-ui/components/composites/ScheduleInterviewDialog';
import { CreateOfferDialog } from '@domains/recruit-ui/components/composites/CreateOfferDialog';

const TERMINAL_STAGES = new Set(['hired', 'rejected', 'withdrawn']);

interface StageHint {
  icon: typeof AlertCircle;
  color: string;
  text: string;
}

function getStageHint(stage: string): StageHint | null {
  if (stage === 'new') return { icon: AlertCircle, color: 'text-blue-600', text: 'Review this application and advance to screening' };
  if (['phone-screen', 'technical', 'on-site'].includes(stage)) return { icon: Clock4, color: 'text-amber-600', text: `${formatLabel(stage)} stage — schedule or review interviews` };
  if (stage === 'final') return { icon: AlertCircle, color: 'text-pink-600', text: 'Final stage — make a hiring decision' };
  if (stage === 'offer') return { icon: FileSignature, color: 'text-emerald-600', text: 'Create and send an offer to this candidate' };
  if (stage === 'hired') return { icon: CheckCircle2, color: 'text-green-600', text: 'Candidate hired' };
  if (stage === 'rejected') return { icon: XCircle, color: 'text-red-500', text: 'Application rejected' };
  if (stage === 'withdrawn') return { icon: XCircle, color: 'text-gray-500', text: 'Candidate withdrew' };
  return null;
}

interface ApplicationPreviewPanelProps {
  applicationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransitionSuccess?: () => void;
}

export function ApplicationPreviewPanel({
  applicationId,
  open,
  onOpenChange,
  onTransitionSuccess,
}: ApplicationPreviewPanelProps) {
  const hooks = useEntityHooks('applications');
  const { apiFn } = useEntityEngine();
  const queryClient = useQueryClient();

  const { data: item } = hooks.useDetail(applicationId);
  const { data: layout } = useEntityLayout('applications');
  const updateMutation = hooks.useUpdate();

  const { data: workflow } = useWorkflowForEntity('applications', applicationId ?? '', 'stage');
  const currentState = item?.stage as string | undefined;
  const transition = useEntityTransition('applications', 'applications', 'Application');

  const [confirmTransition, setConfirmTransition] = useState<{
    toState: string;
    transitionName: string;
    toStateLabel: string;
  } | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showCreateOffer, setShowCreateOffer] = useState(false);

  const searchUsers = useCallback(async (query: string) => {
    const res = await apiFn.get<{ data: { id: string; firstName: string; lastName: string }[] }>(`/users?search=${encodeURIComponent(query)}&limit=20&sort=firstName&order=asc`);
    return res.data.map((u) => ({ label: `${u.firstName} ${u.lastName}`.trim(), value: u.id }));
  }, [apiFn]);

  const searchLookup = useCallback(async (entityName: string, query: string) => {
    return apiFn.get<{ label: string; value: string }[]>(`/lookups/${entityName}?search=${encodeURIComponent(query)}&limit=20`);
  }, [apiFn]);

  const searchTags = useCallback(async (groupSlug: string, query: string) => {
    return apiFn.get<{ label: string; value: string; color?: string }[]>(
      `/tags/group/${groupSlug}?search=${encodeURIComponent(query)}&limit=20`,
    );
  }, [apiFn]);

  const categoryGroupCache = useMemo(() => new Map<string, string>(), []);

  const searchCategories = useCallback(async (groupSlug: string, query: string) => {
    let groupId = categoryGroupCache.get(groupSlug);
    if (!groupId) {
      const groups = await apiFn.get<{ id: string; slug: string }[]>('/category-groups');
      for (const g of groups) categoryGroupCache.set(g.slug, g.id);
      groupId = categoryGroupCache.get(groupSlug);
    }
    if (!groupId) return [];
    const tree = await apiFn.get<{ id: string; name: string }[]>(`/category-groups/${groupId}/tree`);
    const lowerQuery = query.toLowerCase();
    return tree.filter(c => c.name.toLowerCase().includes(lowerQuery)).map(c => ({ label: c.name, value: c.id }));
  }, [apiFn, categoryGroupCache]);

  const getFieldSearch = useCallback((fieldKey: string, fieldType: string) => {
    if (fieldType === 'user') return searchUsers;
    if (!layout) return undefined;
    for (const section of layout.sections) {
      const field = section.fields.find(f => f.fieldKey === fieldKey);
      if (field?.lookupEntity) return (query: string) => searchLookup(field.lookupEntity!, query);
      if (fieldType === 'category' && field?.categoryGroupSlug) {
        return (query: string) => searchCategories(field.categoryGroupSlug!, query);
      }
    }
    return undefined;
  }, [searchUsers, searchLookup, searchCategories, layout]);

  const getChipSearch = useCallback((fieldKey: string, fieldType: string) => {
    if (fieldType === 'multi_user') return searchUsers;
    if (fieldType === 'tags' && layout) {
      for (const section of layout.sections) {
        const field = section.fields.find(f => f.fieldKey === fieldKey);
        if (field?.tagGroupSlug) return (query: string) => searchTags(field.tagGroupSlug!, query);
      }
    }
    return undefined;
  }, [searchUsers, searchTags, layout]);

  const candidateName = item?.candidateId__label as string | undefined;
  const candidateId = item?.candidateId as string | undefined;
  const jobOpeningId = item?.jobOpeningId as string | undefined;
  const stage = item?.stage as string | undefined;
  const stageHint = stage ? getStageHint(stage) : null;

  // Check for existing offer in offer stage
  const { data: existingOffer } = useQuery({
    queryKey: ['applications', applicationId, 'offer'],
    queryFn: () => apiFn.get<{ data: { id: string; status: string }[] }>(`/offers?applicationId=${applicationId}&limit=1`),
    enabled: !!applicationId && stage === 'offer',
  });
  const offer = existingOffer?.data?.[0];

  const handleTransitionSelect = (toState: string, transitionName: string, toStateLabel: string) => {
    setConfirmTransition({ toState, transitionName, toStateLabel });
  };

  const handleConfirmTransition = async () => {
    if (!confirmTransition || !applicationId) return;
    await transition.mutateAsync({ id: applicationId, fieldKey: 'stage', to: confirmTransition.toState });
    setConfirmTransition(null);
    queryClient.invalidateQueries({ queryKey: ['applications'] });
    onTransitionSuccess?.();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-3/4 max-w-2xl overflow-y-auto">
          {item && (
            <>
              <SheetHeader>
                <SheetTitle>{candidateName || 'Application'}</SheetTitle>
                <SheetDescription>
                  Application details
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                {/* Pipeline progress */}
                {workflow && currentState && (
                  <PipelineProgressBar
                    workflowSlug="application-stage"
                    entityType="applications"
                    entityId={applicationId!}
                    currentState={currentState}
                  />
                )}

                {/* Stage hint */}
                {stageHint && (
                  <div className={cn('flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs font-medium', stageHint.color)}>
                    <stageHint.icon className="h-3.5 w-3.5 shrink-0" />
                    {stageHint.text}
                  </div>
                )}

                {/* Stage-adaptive actions */}
                {workflow && stage && !TERMINAL_STAGES.has(stage) && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <WorkflowTransitionButton
                      workflow={workflow}
                      currentState={stage}
                      onTransitionSelect={handleTransitionSelect}
                    />

                    {/* Schedule interview — available for all non-terminal stages */}
                    {candidateId && jobOpeningId && (
                      <Button variant="outline" size="sm" onClick={() => setShowSchedule(true)}>
                        <CalendarPlus className="h-3.5 w-3.5 mr-1.5" />
                        Schedule Interview
                      </Button>
                    )}

                    {/* Offer stage: create/view offer */}
                    {stage === 'offer' && !offer && (
                      <Button size="sm" onClick={() => setShowCreateOffer(true)}>
                        <FileSignature className="h-3.5 w-3.5 mr-1.5" />
                        Create Offer
                      </Button>
                    )}
                    {stage === 'offer' && offer && (
                      <Link to={`/offers/${offer.id}`}>
                        <Button variant="outline" size="sm">
                          <FileSignature className="h-3.5 w-3.5 mr-1.5" />
                          View Offer
                        </Button>
                      </Link>
                    )}

                    <Link to={`/applications/${applicationId}`}>
                      <Button variant="outline" size="sm">
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                        Full Page
                      </Button>
                    </Link>
                  </div>
                )}

                {/* Terminal stages: just show full page link */}
                {stage && TERMINAL_STAGES.has(stage) && (
                  <Link to={`/applications/${applicationId}`}>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                      Full Page
                    </Button>
                  </Link>
                )}

                {/* Field sections */}
                {layout?.sections
                  .filter((s) => s.fields.length > 0)
                  .map((section) => (
                    <DynamicSection
                      key={section.id}
                      section={section}
                      values={item}
                      onSave={async (values) => {
                        await updateMutation.mutateAsync({ id: item.id as string, data: values });
                        onTransitionSuccess?.();
                      }}
                      isSaving={updateMutation.isPending}
                      getFieldSearch={getFieldSearch}
                      getChipSearch={getChipSearch}
                    />
                  ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {confirmTransition && (
        <TransitionConfirmDialog
          open={!!confirmTransition}
          onOpenChange={(open) => { if (!open) setConfirmTransition(null); }}
          transitionName={confirmTransition.transitionName}
          toStateLabel={confirmTransition.toStateLabel}
          isPending={transition.isPending}
          onConfirm={handleConfirmTransition}
        />
      )}

      {showSchedule && candidateId && jobOpeningId && (
        <ScheduleInterviewDialog
          open={showSchedule}
          onOpenChange={setShowSchedule}
          candidateId={candidateId}
          jobOpeningId={jobOpeningId}
          onSuccess={() => setShowSchedule(false)}
        />
      )}

      {showCreateOffer && applicationId && (
        <CreateOfferDialog
          open={showCreateOffer}
          onOpenChange={setShowCreateOffer}
          applicationId={applicationId}
          onSuccess={() => {
            setShowCreateOffer(false);
            queryClient.invalidateQueries({ queryKey: ['applications', applicationId, 'offer'] });
          }}
        />
      )}
    </>
  );
}
