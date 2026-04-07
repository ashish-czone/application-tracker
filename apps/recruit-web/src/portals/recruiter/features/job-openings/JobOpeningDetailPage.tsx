import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Building2, MapPin, Briefcase, Calendar, Users2,
  Clock, MoreHorizontal, Copy, Trash2, UserPlus, FileText,
  LayoutGrid, List,
} from 'lucide-react';
import {
  Button, ConfirmDialog,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  toast, cn,
} from '@packages/ui';
import { DynamicSection } from '@packages/eav-attributes-ui';
import { useEntityEngine, useEntityHooks, useEntityConfig } from '@packages/entity-engine-ui';
import { useEntityLayout } from '@packages/entity-engine-ui/helpers/useEntityLayout';
import { AuditTimeline } from '@packages/platform-ui/audit';
import { EntityPickerPanel } from '@packages/entity-engine-ui/components/EntityPickerPanel';
import { WorkflowKanbanBoard } from '@packages/platform-ui/workflows';
import { StarRating } from '@packages/evaluations-ui';
import { api } from '../../../../lib/api';

type TabKey = 'details' | 'applications' | 'audit';

const STATUS_STYLES: Record<string, { bg: string; dot: string }> = {
  'in-progress': { bg: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  'waiting-for-approval': { bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  'on-hold': { bg: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-400' },
  'filled': { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  'cancelled': { bg: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-400' },
  'declined': { bg: 'bg-red-50 text-red-600 border-red-200', dot: 'bg-red-400' },
  'inactive': { bg: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400' },
};

const STAGE_COLORS: Record<string, string> = {
  'new': 'bg-gray-500',
  'phone-screen': 'bg-blue-500',
  'technical': 'bg-violet-500',
  'on-site': 'bg-amber-500',
  'final': 'bg-pink-500',
  'offer': 'bg-emerald-500',
  'hired': 'bg-green-600',
  'rejected': 'bg-red-400',
  'withdrawn': 'bg-gray-400',
};

function formatLabel(value: string): string {
  return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

interface Application {
  id: string;
  candidateId__label: string;
  stage: string;
  source: string;
  averageRating: number | null;
  createdAt: string;
}

export function JobOpeningDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const entity = useEntityConfig('job_openings');
  const hooks = useEntityHooks('job_openings');
  const { apiFn } = useEntityEngine();

  const [activeTab, setActiveTab] = useState<TabKey>('details');
  const [pipelineView, setPipelineView] = useState<'board' | 'list'>('board');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showApplyPicker, setShowApplyPicker] = useState(false);

  const { data: item, isLoading, isError } = hooks.useDetail(id ?? null);
  const { data: layout } = useEntityLayout('job_openings');
  const deleteMutation = hooks.useDelete({ onSuccess: () => navigate('/job-openings') });
  const cloneMutation = hooks.useClone();
  const updateMutation = hooks.useUpdate();

  // Fetch applications for this job
  const { data: applicationsData } = useQuery({
    queryKey: ['job_openings', id, 'applications'],
    queryFn: () => apiFn.get<{ data: Application[] }>(`/applications?jobOpeningId=${id}&limit=100`),
    enabled: !!id,
  });
  const applications = applicationsData?.data ?? [];

  // Compute stage distribution
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const app of applications) {
      counts[app.stage] = (counts[app.stage] ?? 0) + 1;
    }
    return counts;
  }, [applications]);

  // Search callbacks
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

  const getFieldSearchForSection = useCallback((fieldKey: string, fieldType: string) => {
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

  const getChipSearchForSection = useCallback((fieldKey: string, fieldType: string) => {
    if (fieldType === 'multi_user') return searchUsers;
    if (fieldType === 'tags' && layout) {
      for (const section of layout.sections) {
        const field = section.fields.find(f => f.fieldKey === fieldKey);
        if (field?.tagGroupSlug) return (query: string) => searchTags(field.tagGroupSlug!, query);
      }
    }
    return undefined;
  }, [searchUsers, searchTags, layout]);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="h-6 w-32 animate-pulse rounded bg-muted" />
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (isError || !item) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Job opening not found</p>
        <Link to="/job-openings" className="text-sm text-primary hover:underline mt-2 inline-block">Back to job openings</Link>
      </div>
    );
  }

  const title = String(item.title ?? '');
  const status = String(item.status ?? 'in-progress');
  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES['in-progress'];
  const clientName = item.clientId__label as string;
  const dept = item.department as string;
  const loc = item.location as string;
  const positions = Number(item.numberOfPositions ?? 1);
  const daysOpen = item.createdAt ? daysSince(item.createdAt as string) : 0;
  const applicationsCount = applications.length;

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'details', label: 'Details' },
    { key: 'applications', label: 'Pipeline', count: applicationsCount },
    { key: 'audit', label: 'History' },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      <Link
        to="/job-openings"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Job Openings
      </Link>

      {/* Job header card */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden mb-6">
        <div className="h-1.5 bg-gradient-to-r from-blue-500 to-indigo-600" />
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-foreground">{title}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                {clientName && (
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    {clientName}
                  </span>
                )}
                {(dept || loc) && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {[dept, loc].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
            </div>
            <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${statusStyle.bg}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
              {formatLabel(status)}
            </span>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2 text-sm">
              <Users2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-foreground">{positions}</span>
              <span className="text-muted-foreground">{positions === 1 ? 'position' : 'positions'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-foreground">{applicationsCount}</span>
              <span className="text-muted-foreground">{applicationsCount === 1 ? 'applicant' : 'applicants'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-foreground">{daysOpen}</span>
              <span className="text-muted-foreground">days open</span>
            </div>

            <div className="flex-1" />

            <Button size="sm" onClick={() => setShowApplyPicker(true)}>
              <UserPlus className="h-3.5 w-3.5 mr-1.5" />
              Add Candidate
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={async () => {
                  try {
                    const created = await cloneMutation.mutateAsync(item.id as string);
                    navigate(`/job-openings/${(created as any).id}`);
                  } catch { /* handled */ }
                }}>
                  <Copy className="h-4 w-4 mr-2" />
                  Clone
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowDeleteConfirm(true)} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Pipeline summary bar */}
          {applicationsCount > 0 && (
            <div className="mt-4">
              <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                {Object.entries(stageCounts).map(([stage, count]) => (
                  <div
                    key={stage}
                    className={`${STAGE_COLORS[stage] ?? 'bg-gray-400'} transition-all`}
                    style={{ width: `${(count / applicationsCount) * 100}%` }}
                    title={`${formatLabel(stage)}: ${count}`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                {Object.entries(stageCounts).map(([stage, count]) => (
                  <span key={stage} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={`h-2 w-2 rounded-full ${STAGE_COLORS[stage] ?? 'bg-gray-400'}`} />
                    {formatLabel(stage)} ({count})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`relative px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg ${
                activeTab === tab.key ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="flex items-center gap-1.5">
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`inline-flex items-center justify-center h-5 min-w-[20px] rounded-full px-1.5 text-[11px] font-semibold ${
                    activeTab === tab.key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </span>
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'details' && (
        <div className="space-y-4">
          {layout?.sections
            .filter((s) => s.fields.length > 0)
            .map((section) => (
              <DynamicSection
                key={section.id}
                section={section}
                values={item}
                onSave={async (values) => {
                  await updateMutation.mutateAsync({ id: item.id as string, data: values });
                }}
                isSaving={updateMutation.isPending}
                getFieldSearch={getFieldSearchForSection}
                getChipSearch={getChipSearchForSection}
              />
            ))}
        </div>
      )}

      {activeTab === 'applications' && (
        <div>
          {applications.length === 0 ? (
            <div className="text-center py-12 rounded-lg border border-dashed border-border">
              <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">No applications yet</p>
              <p className="text-sm text-muted-foreground mt-1">Add candidates to this job opening to build your pipeline.</p>
              <Button size="sm" className="mt-4" onClick={() => setShowApplyPicker(true)}>
                Add Candidate
              </Button>
            </div>
          ) : (
            <>
              {/* View toggle */}
              <div className="flex items-center justify-between mb-4">
                <div className="inline-flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
                  <button
                    type="button"
                    onClick={() => setPipelineView('board')}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                      pipelineView === 'board'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    Board
                  </button>
                  <button
                    type="button"
                    onClick={() => setPipelineView('list')}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                      pipelineView === 'list'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <List className="h-3.5 w-3.5" />
                    List
                  </button>
                </div>
              </div>

              {pipelineView === 'board' ? (
                <WorkflowKanbanBoard
                  workflowSlug="application-stage"
                  entitySlug="applications"
                  entityType="applications"
                  singularName="Application"
                  fieldName="stage"
                  records={applications}
                  onTransitionSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['job_openings', id, 'applications'] });
                  }}
                  renderCard={(record) => (
                    <Link
                      to={`/applications/${record.id}`}
                      className="block w-full group/card"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="text-[13px] font-medium text-foreground group-hover/card:text-primary transition-colors leading-snug truncate">
                        {(record.candidateId__label as string) || 'Candidate'}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        {record.source && (
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {formatLabel(record.source as string)}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground/60">
                          {daysSince(record.createdAt as string)}d
                        </span>
                      </div>
                      {(record.averageRating as number) > 0 && (
                        <div className="mt-1.5">
                          <StarRating value={record.averageRating as number} size="sm" />
                        </div>
                      )}
                    </Link>
                  )}
                />
              ) : (
                <div className="space-y-2">
                  {applications.map((app) => (
                    <Link
                      key={app.id}
                      to={`/applications/${app.id}`}
                      className="group flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 hover:border-primary/30 hover:shadow-sm transition-all"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {app.candidateId__label || 'Candidate'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Applied {formatDate(app.createdAt)}
                        </p>
                      </div>
                      <span className={`shrink-0 ml-3 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        `${STAGE_COLORS[app.stage]?.replace('bg-', 'bg-').replace('500', '100').replace('600', '100').replace('400', '100')} text-foreground`
                      }`}
                        style={{
                          backgroundColor: `color-mix(in srgb, ${getComputedStyle(document.documentElement).getPropertyValue('--background') || '#fff'} 90%, ${STAGE_COLORS[app.stage]?.includes('blue') ? '#3b82f6' : STAGE_COLORS[app.stage]?.includes('violet') ? '#8b5cf6' : STAGE_COLORS[app.stage]?.includes('amber') ? '#f59e0b' : STAGE_COLORS[app.stage]?.includes('emerald') ? '#10b981' : STAGE_COLORS[app.stage]?.includes('green') ? '#059669' : STAGE_COLORS[app.stage]?.includes('red') ? '#ef4444' : STAGE_COLORS[app.stage]?.includes('pink') ? '#ec4899' : '#6b7280'})`,
                        }}
                      >
                        {formatLabel(app.stage)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <AuditTimeline entityType="job_openings" entityId={item.id as string} />
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete job opening"
        description={`This will delete "${title}".`}
        confirmLabel="Delete"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(item.id as string)}
      />

      {showApplyPicker && (
        <EntityPickerPanel
          mode="picker"
          open={showApplyPicker}
          onOpenChange={setShowApplyPicker}
          entityType="candidates"
          pickerConfig={{
            entityType: 'candidates',
            selectionMode: 'multiple',
            submitUrl: '/applications',
            fieldMapping: { jobOpeningId: ':id', candidateId: ':selectedId' },
            existingCheck: {
              listUrl: '/applications',
              filterField: 'jobOpeningId',
              matchField: 'candidateId',
              label: 'Already applied',
              disableSelection: true,
            },
          }}
          sourceId={item.id as string}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['job_openings'] });
            queryClient.invalidateQueries({ queryKey: ['job_openings', id, 'applications'] });
          }}
        />
      )}
    </div>
  );
}
