import { useCallback, useMemo } from 'react';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import {
  Button,
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@packages/ui';
import { DynamicSection } from '@packages/eav-attributes-ui';
import { useEntityEngine, useEntityHooks } from '@packages/entity-engine-ui';
import { useEntityLayout } from '@packages/entity-engine-ui/helpers/useEntityLayout';
import {
  PipelineProgressBar,
  WorkflowTransitionButton,
  TransitionConfirmDialog,
  useWorkflowForEntity,
  useEntityTransition,
} from '@packages/platform-ui/workflows';
import { useState } from 'react';

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

  const { workflow, currentState } = useWorkflowForEntity('application-stage', 'applications', applicationId ?? '');
  const transition = useEntityTransition('applications', applicationId ?? '', 'stage');

  const [confirmTransition, setConfirmTransition] = useState<{
    toState: string;
    transitionName: string;
    toStateLabel: string;
  } | null>(null);

  const searchUsers = useCallback(async (query: string) => {
    const res = await apiFn.get<{ data: { id: string; firstName: string; lastName: string }[] }>(`/users?search=${encodeURIComponent(query)}&limit=20`);
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
  const stage = item?.stage as string | undefined;

  const handleTransitionSelect = (toState: string, transitionName: string, toStateLabel: string) => {
    setConfirmTransition({ toState, transitionName, toStateLabel });
  };

  const handleConfirmTransition = async () => {
    if (!confirmTransition) return;
    await transition.mutateAsync({ toState: confirmTransition.toState });
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

                {/* Workflow actions */}
                {workflow && stage && (
                  <div className="flex items-center gap-2">
                    <WorkflowTransitionButton
                      workflow={workflow}
                      currentState={stage}
                      onTransitionSelect={handleTransitionSelect}
                    />
                    <Link to={`/applications/${applicationId}`}>
                      <Button variant="outline" size="sm">
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                        Open Full Page
                      </Button>
                    </Link>
                  </div>
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
          toStateLabel={confirmTransition.toStateLabel}
          isPending={transition.isPending}
          onConfirm={handleConfirmTransition}
        />
      )}
    </>
  );
}
