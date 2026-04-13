import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Building2, MapPin, Briefcase, Calendar, Users2, User,
  Clock, MoreHorizontal, Copy, Trash2, UserPlus, FileText,
  LayoutGrid, List, CalendarPlus, TrendingUp, Activity, FileSignature,
  AlertCircle, Clock4, UserCheck, Layers,
} from 'lucide-react';
import {
  Button, ConfirmDialog,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  toast, cn,
} from '@packages/ui';
import { DynamicSection } from '@packages/eav-attributes-ui';
import { useEntityEngine, useEntityHooks, useEntityConfig } from '@packages/entity-engine-ui';
import { useEntityLayout } from '@packages/entity-engine-ui/helpers/useEntityLayout';
import { AuditTimeline, useAuditLogs } from '@packages/platform-ui/audit';
import { EntityPickerPanel } from '@packages/entity-engine-ui/components/EntityPickerPanel';
import { WorkflowKanbanBoard } from '@packages/platform-ui/workflows';
import { StarRating } from '@packages/evaluations-ui';
import { ScheduleInterviewDialog } from '@domains/recruit-web/portals/recruiter/features/shared/ScheduleInterviewDialog';
import { CreateOfferDialog } from '@domains/recruit-web/portals/recruiter/features/shared/CreateOfferDialog';
import { ApplicationPreviewPanel } from '../applications/ApplicationPreviewPanel';
import { formatLabel, formatDate } from '@packages/common';
import { api } from '../../../../lib/api';

type TabKey = 'overview' | 'applications' | 'audit';

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

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

interface Application {
  id: string;
  candidateId: string;
  candidateId__label: string;
  stage: string;
  source: string;
  averageRating: number | null;
  evaluationsCount: number | null;
  referredBy: string | null;
  referredBy__label: string | null;
  createdAt: string;
}

interface Interview {
  id: string;
  candidateId: string;
  jobOpeningId: string;
  status: string;
  interviewFrom: string;
}

type CardActionStatus = 'red' | 'amber' | 'none';

interface CardAction {
  status: CardActionStatus;
  label: string | null;
}

const INTERVIEW_STAGES = new Set(['phone-screen', 'technical', 'on-site']);

function getCardAction(
  app: Application,
  interviewsByCandidate: Map<string, Interview[]>,
): CardAction {
  const { stage, evaluationsCount } = app;

  // Terminal / offer stages — no action indicator
  if (['hired', 'rejected', 'withdrawn', 'offer'].includes(stage)) {
    return { status: 'none', label: null };
  }

  // Interview stages: check for scheduled/completed interviews
  if (INTERVIEW_STAGES.has(stage)) {
    const interviews = interviewsByCandidate.get(app.candidateId) ?? [];
    const scheduled = interviews.filter((i) => i.status === 'scheduled');
    const completed = interviews.filter((i) => i.status === 'completed');

    if (scheduled.length > 0) {
      return { status: 'amber', label: 'Interview scheduled' };
    }
    if (completed.length > 0 && (evaluationsCount ?? 0) === 0) {
      return { status: 'red', label: 'Needs evaluation' };
    }
    return { status: 'red', label: 'Schedule interview' };
  }

  // New stage — flag if stale
  if (stage === 'new') {
    if (daysSince(app.createdAt) > 5) {
      return { status: 'red', label: 'Review application' };
    }
    return { status: 'none', label: null };
  }

  // Final stage — decision needed
  if (stage === 'final') {
    return { status: 'red', label: 'Make decision' };
  }

  return { status: 'none', label: null };
}

const ACTION_BORDER_COLOR: Record<CardActionStatus, string> = {
  red: 'border-l-red-400',
  amber: 'border-l-amber-400',
  none: 'border-l-transparent',
};

const ACTION_TEXT_COLOR: Record<CardActionStatus, string> = {
  red: 'text-red-600',
  amber: 'text-amber-600',
  none: '',
};

export function JobOpeningDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const entity = useEntityConfig('job_openings');
  const hooks = useEntityHooks('job_openings');
  const { apiFn } = useEntityEngine();

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [pipelineView, setPipelineView] = useState<'board' | 'list'>('board');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showApplyPicker, setShowApplyPicker] = useState(false);
  const [scheduleFor, setScheduleFor] = useState<{ candidateId: string; jobOpeningId: string } | null>(null);
  const [createOfferFor, setCreateOfferFor] = useState<string | null>(null);
  const [previewApplicationId, setPreviewApplicationId] = useState<string | null>(null);

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

  // Fetch offers for this job's applications to show offer status on kanban cards
  const { data: offersData } = useQuery({
    queryKey: ['job_openings', id, 'offers'],
    queryFn: () => apiFn.get<{ data: { id: string; applicationId: string; status: string }[] }>('/offers?limit=100'),
    enabled: !!id,
  });
  const offersByAppId = useMemo(() => {
    const map = new Map<string, { id: string; status: string }>();
    for (const offer of offersData?.data ?? []) {
      map.set(offer.applicationId, { id: offer.id, status: offer.status });
    }
    return map;
  }, [offersData]);

  // Fetch interviews for this job to determine action status on kanban cards
  const { data: interviewsData } = useQuery({
    queryKey: ['job_openings', id, 'interviews'],
    queryFn: () => apiFn.get<{ data: Interview[] }>(`/interviews?jobOpeningId=${id}&limit=200`),
    enabled: !!id,
  });
  const interviewsByCandidate = useMemo(() => {
    const map = new Map<string, Interview[]>();
    for (const interview of interviewsData?.data ?? []) {
      const list = map.get(interview.candidateId) ?? [];
      list.push(interview);
      map.set(interview.candidateId, list);
    }
    return map;
  }, [interviewsData]);

  // Fetch cross-job applications to show candidate awareness on cards
  const candidateIds = useMemo(() => [...new Set(applications.map((a) => a.candidateId))], [applications]);
  const { data: allAppsData } = useQuery({
    queryKey: ['cross-job-applications', candidateIds.sort().join(',')],
    queryFn: () => apiFn.get<{ data: { candidateId: string; jobOpeningId: string; stage: string }[] }>('/applications?limit=500'),
    enabled: candidateIds.length > 0,
    staleTime: 60_000,
  });
  const otherJobCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (!allAppsData?.data) return counts;
    const candidateSet = new Set(candidateIds);
    for (const app of allAppsData.data) {
      if (candidateSet.has(app.candidateId) && app.jobOpeningId !== id) {
        counts.set(app.candidateId, (counts.get(app.candidateId) ?? 0) + 1);
      }
    }
    return counts;
  }, [allAppsData, candidateIds, id]);

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

  // Source breakdown — must be above early returns (Rules of Hooks)
  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const app of applications) {
      const src = app.source || 'Unknown';
      counts[src] = (counts[src] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [applications]);

  // Avg days in pipeline
  const avgDaysInPipeline = useMemo(() => {
    if (applications.length === 0) return 0;
    const total = applications.reduce((sum, app) => sum + daysSince(app.createdAt), 0);
    return Math.round(total / applications.length);
  }, [applications]);

  // Recent activity for this job's applications
  const { data: activityData } = useAuditLogs({ entityType: 'job_openings', entityId: id ?? '', includeRelated: true, limit: 5 });
  const recentActivity = activityData?.data ?? [];

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
  const positionsFilled = applications.filter((a) => a.stage === 'hired').length;
  const daysOpen = item.createdAt ? daysSince(item.createdAt as string) : 0;
  const applicationsCount = applications.length;
  const hiringManagerName = item.hiringManager__label as string | undefined;

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
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
                {hiringManagerName && (
                  <span className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    {hiringManagerName}
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
              <span className="font-semibold text-foreground">{positionsFilled} / {positions}</span>
              <span className="text-muted-foreground">filled</span>
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
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick stats row */}
          {applicationsCount > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Avg. Days in Pipeline
                </div>
                <div className="text-2xl font-semibold text-foreground">{avgDaysInPipeline}</div>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Users2 className="h-3.5 w-3.5" />
                  Positions Filled
                </div>
                <div className="text-2xl font-semibold text-foreground">{positionsFilled} <span className="text-sm font-normal text-muted-foreground">/ {positions}</span></div>
              </div>
              <div className="col-span-2 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <FileText className="h-3.5 w-3.5" />
                  Source Breakdown
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {sourceCounts.map(([source, count]) => (
                    <span key={source} className="text-sm">
                      <span className="font-medium text-foreground">{count}</span>
                      <span className="text-muted-foreground ml-1">{formatLabel(source)}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Recent activity */}
          {recentActivity.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <Activity className="h-3.5 w-3.5" />
                Recent Activity
              </div>
              <div className="space-y-2">
                {recentActivity.map((entry: any) => (
                  <div key={entry.id} className="flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <span className="text-foreground">{entry.description || entry.action}</span>
                      {entry.actorName && (
                        <span className="text-muted-foreground"> by {entry.actorName}</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-3">
                      {formatDate(entry.occurredAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Form sections */}
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
                  records={applications as unknown as Record<string, unknown>[]}
                  onTransitionSuccess={({ recordId, toState }) => {
                    queryClient.invalidateQueries({ queryKey: ['job_openings', id, 'applications'] });
                    if (toState === 'offer' && !offersByAppId.has(recordId)) {
                      toast('Ready to create an offer?', {
                        action: {
                          label: 'Create Offer',
                          onClick: () => setCreateOfferFor(recordId),
                        },
                        duration: 8000,
                      });
                    }
                  }}
                  renderCard={(record) => {
                    const app = record as unknown as Application;
                    const action = getCardAction(app, interviewsByCandidate);
                    const offer = offersByAppId.get(app.id);
                    const otherJobs = otherJobCounts.get(app.candidateId) ?? 0;

                    return (
                      <div
                        className={cn(
                          'group/card relative -mx-3.5 -mt-3 -mb-3 px-3.5 pt-3 pb-3 border-l-[3px]',
                          ACTION_BORDER_COLOR[action.status],
                        )}
                      >
                        <div
                          className="block w-full cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); setPreviewApplicationId(app.id); }}
                        >
                          {/* Name + referral badge + cross-job indicator */}
                          <div className="flex items-center gap-1.5 pr-6">
                            <span className="text-[13px] font-medium text-foreground group-hover/card:text-primary transition-colors leading-snug truncate">
                              {app.candidateId__label || 'Candidate'}
                            </span>
                            {app.referredBy__label && (
                              <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-violet-100 dark:bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700 dark:text-violet-400" title={`Referred by ${app.referredBy__label}`}>
                                <UserCheck className="h-2.5 w-2.5" />
                                Ref
                              </span>
                            )}
                            {otherJobs > 0 && (
                              <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-sky-100 dark:bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-sky-700 dark:text-sky-400" title={`Applied to ${otherJobs} other job${otherJobs > 1 ? 's' : ''}`}>
                                <Layers className="h-2.5 w-2.5" />
                                +{otherJobs}
                              </span>
                            )}
                          </div>

                          {/* Source + applied date + days in stage */}
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            {app.source && (
                              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                {formatLabel(app.source)}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground/60" title={`Applied ${formatDate(app.createdAt)}`}>
                              {formatDate(app.createdAt)}
                            </span>
                            <span className="text-[10px] text-muted-foreground/40">
                              {daysSince(app.createdAt)}d in pipeline
                            </span>
                          </div>

                          {/* Rating + evaluation count */}
                          {((app.averageRating ?? 0) > 0 || (app.evaluationsCount ?? 0) > 0) && (
                            <div className="flex items-center gap-2 mt-1.5">
                              {(app.averageRating ?? 0) > 0 && (
                                <StarRating value={app.averageRating!} size="sm" />
                              )}
                              {(app.evaluationsCount ?? 0) > 0 && (
                                <span className="text-[10px] text-muted-foreground">
                                  {app.evaluationsCount} eval{app.evaluationsCount !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Action indicator */}
                          {action.label && (
                            <div className={cn('flex items-center gap-1 mt-2 text-[10px] font-medium', ACTION_TEXT_COLOR[action.status])}>
                              {action.status === 'red' && <AlertCircle className="h-3 w-3" />}
                              {action.status === 'amber' && <Clock4 className="h-3 w-3" />}
                              {action.label}
                            </div>
                          )}

                          {/* Offer status (offer stage only) */}
                          {app.stage === 'offer' && (() => {
                            if (offer) {
                              return (
                                <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                  <FileSignature className="h-2.5 w-2.5" />
                                  {offer.status.replace(/[-_]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                                </span>
                              );
                            }
                            return (
                              <button
                                type="button"
                                className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-dashed border-primary/40 px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/5 transition-colors"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setCreateOfferFor(app.id);
                                }}
                              >
                                <FileSignature className="h-2.5 w-2.5" />
                                Create Offer
                              </button>
                            );
                          })()}
                        </div>
                        <button
                          type="button"
                          title="Schedule Interview"
                          className="absolute top-3 right-3.5 p-0.5 rounded text-muted-foreground/0 group-hover/card:text-muted-foreground hover:!text-primary transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setScheduleFor({ candidateId: app.candidateId, jobOpeningId: id! });
                          }}
                        >
                          <CalendarPlus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  }}
                />
              ) : (
                <div className="space-y-2">
                  {applications.map((app) => {
                    const action = getCardAction(app, interviewsByCandidate);
                    return (
                      <div
                        key={app.id}
                        className={cn(
                          'group flex items-center justify-between rounded-lg border bg-card px-4 py-3 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer border-l-[3px]',
                          ACTION_BORDER_COLOR[action.status],
                          action.status === 'none' && 'border-l-border',
                        )}
                        onClick={() => setPreviewApplicationId(app.id)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                              {app.candidateId__label || 'Candidate'}
                            </p>
                            {app.referredBy__label && (
                              <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-violet-100 dark:bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700 dark:text-violet-400">
                                <UserCheck className="h-2.5 w-2.5" />
                                Ref
                              </span>
                            )}
                            {(otherJobCounts.get(app.candidateId) ?? 0) > 0 && (
                              <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-sky-100 dark:bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-sky-700 dark:text-sky-400" title={`Applied to ${otherJobCounts.get(app.candidateId)} other job(s)`}>
                                <Layers className="h-2.5 w-2.5" />
                                +{otherJobCounts.get(app.candidateId)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">
                              Applied {formatDate(app.createdAt)}
                            </span>
                            {action.label && (
                              <span className={cn('text-[10px] font-medium flex items-center gap-0.5', ACTION_TEXT_COLOR[action.status])}>
                                {action.status === 'red' && <AlertCircle className="h-3 w-3" />}
                                {action.status === 'amber' && <Clock4 className="h-3 w-3" />}
                                {action.label}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          {(app.averageRating ?? 0) > 0 && (
                            <StarRating value={app.averageRating!} size="sm" />
                          )}
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STAGE_COLORS[app.stage] ?? 'bg-gray-400'} text-white`}>
                            {formatLabel(app.stage)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
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

      {scheduleFor && (
        <ScheduleInterviewDialog
          open={!!scheduleFor}
          onOpenChange={(open) => { if (!open) setScheduleFor(null); }}
          candidateId={scheduleFor.candidateId}
          jobOpeningId={scheduleFor.jobOpeningId}
          onSuccess={() => setScheduleFor(null)}
        />
      )}

      {createOfferFor && (
        <CreateOfferDialog
          open={!!createOfferFor}
          onOpenChange={(open) => { if (!open) setCreateOfferFor(null); }}
          applicationId={createOfferFor}
          onSuccess={() => {
            setCreateOfferFor(null);
            queryClient.invalidateQueries({ queryKey: ['job_openings', id, 'offers'] });
          }}
        />
      )}

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

      <ApplicationPreviewPanel
        applicationId={previewApplicationId}
        open={!!previewApplicationId}
        onOpenChange={(open) => { if (!open) setPreviewApplicationId(null); }}
        onTransitionSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['job_openings', id, 'applications'] });
        }}
      />
    </div>
  );
}
