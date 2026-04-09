import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Mail, Phone, MapPin, Building2, Briefcase,
  Calendar, Globe, Linkedin, ExternalLink, MoreHorizontal,
  Copy, Trash2, Pencil, CalendarPlus, ClipboardCheck, ArrowRight,
} from 'lucide-react';
import {
  Button, Badge, ConfirmDialog,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
  toast,
} from '@packages/ui';
import { DynamicSection } from '@packages/eav-attributes-ui';
import { useEntityEngine, useEntityHooks, useEntityConfig } from '@packages/entity-engine-ui';
import { useEntityLayout } from '@packages/entity-engine-ui/helpers/useEntityLayout';
import { AuditTimeline } from '@packages/platform-ui/audit';
import { NotesSection } from '@packages/notes-ui';
import { AttachmentsSection } from '@packages/attachments-ui';
import {
  PipelineProgressBar,
  TransitionConfirmDialog,
  WorkflowTransitionButton,
  useWorkflowForEntity,
  useWorkflows,
  useEntityTransition,
} from '@packages/platform-ui/workflows';
import { EntityPickerPanel } from '@packages/entity-engine-ui/components/EntityPickerPanel';
import { formatLabel, formatDate } from '@packages/common';
import { ScheduleInterviewDialog } from '../shared/ScheduleInterviewDialog';
import { api } from '../../../../lib/api';

type TabKey = 'overview' | 'applications' | 'notes' | 'attachments' | 'activity';

const STATUS_COLORS: Record<string, string> = {
  'new': 'bg-blue-50 text-blue-700 border-blue-200',
  'in-review': 'bg-amber-50 text-amber-700 border-amber-200',
  'qualified': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'unqualified': 'bg-red-50 text-red-700 border-red-200',
  'junk-candidate': 'bg-gray-100 text-gray-500 border-gray-200',
  'contacted': 'bg-violet-50 text-violet-700 border-violet-200',
  'contact-in-future': 'bg-sky-50 text-sky-700 border-sky-200',
  'not-contacted': 'bg-gray-50 text-gray-600 border-gray-200',
  'attempted-to-contact': 'bg-orange-50 text-orange-700 border-orange-200',
  'reviewed': 'bg-teal-50 text-teal-700 border-teal-200',
};

const STAGE_COLORS: Record<string, string> = {
  'new': 'bg-gray-100 text-gray-700',
  'phone-screen': 'bg-blue-100 text-blue-700',
  'technical': 'bg-violet-100 text-violet-700',
  'on-site': 'bg-amber-100 text-amber-700',
  'final': 'bg-pink-100 text-pink-700',
  'offer': 'bg-emerald-100 text-emerald-700',
  'hired': 'bg-green-100 text-green-800',
  'rejected': 'bg-red-100 text-red-700',
  'withdrawn': 'bg-gray-100 text-gray-500',
};

const AVATAR_COLORS = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-blue-600',
  'from-fuchsia-500 to-purple-600',
  'from-teal-500 to-emerald-600',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface Application {
  id: string;
  jobOpeningId: string;
  jobOpeningId__label: string;
  stage: string;
  createdAt: string;
}

export function CandidateProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const entity = useEntityConfig('candidates');
  const hooks = useEntityHooks('candidates');
  const { apiFn } = useEntityEngine();

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showApplyPicker, setShowApplyPicker] = useState(false);
  const [scheduleFor, setScheduleFor] = useState<{ candidateId: string; jobOpeningId: string } | null>(null);

  const { data: item, isLoading, isError } = hooks.useDetail(id ?? null);
  const { data: layout } = useEntityLayout('candidates');
  const deleteMutation = hooks.useDelete({ onSuccess: () => navigate('/candidates') });
  const cloneMutation = hooks.useClone();
  const updateMutation = hooks.useUpdate();

  // Fetch applications for this candidate
  const { data: applicationsData } = useQuery({
    queryKey: ['candidates', id, 'applications'],
    queryFn: () => apiFn.get<{ data: Application[] }>(`/applications?candidateId=${id}&limit=50`),
    enabled: !!id,
  });
  const applications = applicationsData?.data ?? [];

  // Search callbacks for inline editing
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
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (isError || !item) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Candidate not found</p>
        <Link to="/candidates" className="text-sm text-primary hover:underline mt-2 inline-block">
          Back to candidates
        </Link>
      </div>
    );
  }

  const firstName = String(item.firstName ?? '');
  const lastName = String(item.lastName ?? '');
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const initials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || '?';
  const avatarGradient = getAvatarColor(fullName);
  const status = String(item.candidateStatus ?? 'new');
  const statusStyle = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600 border-gray-200';
  const title = item.currentTitle as string;
  const company = item.currentCompany as string;
  const subtitle = [title, company].filter(Boolean).join(' at ');
  const email = item.email as string;
  const phone = (item.mobile ?? item.phone) as string;
  const city = item.city as string;
  const country = item.country as string;
  const location = [city, country].filter(Boolean).join(', ');
  const skills = (item.skills ?? []) as { id: string; name: string; color?: string }[];
  const applicationsCount = typeof item.applicationsCount === 'number' ? item.applicationsCount : Number(item.applicationsCount ?? 0);

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'applications', label: 'Applications', count: applicationsCount },
    { key: 'notes', label: 'Notes' },
    { key: 'attachments', label: 'Files' },
    { key: 'activity', label: 'Activity' },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back nav */}
      <Link
        to="/candidates"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Candidates
      </Link>

      {/* Profile hero card */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden mb-6">
        {/* Gradient accent bar */}
        <div className={`h-1.5 bg-gradient-to-r ${avatarGradient}`} />

        <div className="p-5">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className={`h-16 w-16 rounded-xl bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-white text-xl font-semibold shrink-0 shadow-md`}>
              {initials}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-semibold text-foreground">{fullName}</h1>
                  {subtitle && (
                    <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5" />
                      {subtitle}
                    </p>
                  )}
                </div>
                <span className={`shrink-0 inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${statusStyle}`}>
                  {formatLabel(status)}
                </span>
              </div>

              {/* Contact row */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 text-sm text-muted-foreground">
                {email && (
                  <a href={`mailto:${email}`} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                    <Mail className="h-3.5 w-3.5" />
                    {email}
                  </a>
                )}
                {phone && (
                  <a href={`tel:${phone}`} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                    <Phone className="h-3.5 w-3.5" />
                    {phone}
                  </a>
                )}
                {location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {location}
                  </span>
                )}
                {item.linkedinUrl && (
                  <a href={item.linkedinUrl as string} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                    <Linkedin className="h-3.5 w-3.5" />
                    LinkedIn
                  </a>
                )}
              </div>

              {/* Skills */}
              {skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {skills.map((skill) => (
                    <span
                      key={skill.id}
                      className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                    >
                      {skill.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action toolbar */}
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border flex-wrap">
            {email && (
              <Button variant="outline" size="sm" asChild>
                <a href={`mailto:${email}`}>
                  <Mail className="h-3.5 w-3.5 mr-1.5" />
                  Email
                </a>
              </Button>
            )}

            {applications.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const activeApp = applications.find((a) => !['hired', 'rejected', 'withdrawn'].includes(a.stage));
                    if (activeApp) {
                      setScheduleFor({ candidateId: id!, jobOpeningId: activeApp.jobOpeningId });
                    } else {
                      setScheduleFor({ candidateId: id!, jobOpeningId: applications[0].jobOpeningId });
                    }
                  }}
                >
                  <CalendarPlus className="h-3.5 w-3.5 mr-1.5" />
                  Schedule
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const activeApp = applications.find((a) => !['hired', 'rejected', 'withdrawn'].includes(a.stage));
                    navigate(`/applications/${activeApp?.id ?? applications[0].id}`);
                  }}
                >
                  <ClipboardCheck className="h-3.5 w-3.5 mr-1.5" />
                  Evaluate
                </Button>
              </>
            )}

            <Button size="sm" onClick={() => setShowApplyPicker(true)}>
              <Briefcase className="h-3.5 w-3.5 mr-1.5" />
              Apply to Job
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={async () => {
                  try {
                    const created = await cloneMutation.mutateAsync(item.id as string);
                    navigate(`/candidates/${(created as any).id}`);
                  } catch { /* handled by hook */ }
                }}>
                  <Copy className="h-4 w-4 mr-2" />
                  Clone
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
                activeTab === tab.key
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
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
              <Briefcase className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">No applications yet</p>
              <p className="text-sm text-muted-foreground mt-1">Apply this candidate to a job opening to get started.</p>
              <Button size="sm" className="mt-4" onClick={() => setShowApplyPicker(true)}>
                Apply to Job
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {applications.map((app) => (
                <Link
                  key={app.id}
                  to={`/applications/${app.id}`}
                  className="group flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                      <Briefcase className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {app.jobOpeningId__label || 'Job Opening'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Applied {formatDate(app.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STAGE_COLORS[app.stage] ?? 'bg-gray-100 text-gray-700'}`}>
                      {formatLabel(app.stage)}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'notes' && (
        <NotesSection entityType="candidates" entityId={item.id as string} />
      )}

      {activeTab === 'attachments' && (
        <AttachmentsSection entityType="candidates" entityId={item.id as string} />
      )}

      {activeTab === 'activity' && (
        <AuditTimeline entityType="candidates" entityId={item.id as string} mode="activity" />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete candidate"
        description={`This will delete "${fullName}".`}
        confirmLabel="Delete candidate"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(item.id as string)}
      />

      {/* Schedule interview dialog */}
      {scheduleFor && (
        <ScheduleInterviewDialog
          open={!!scheduleFor}
          onOpenChange={(open) => { if (!open) setScheduleFor(null); }}
          candidateId={scheduleFor.candidateId}
          jobOpeningId={scheduleFor.jobOpeningId}
          onSuccess={() => setScheduleFor(null)}
        />
      )}

      {/* Apply to job picker */}
      {showApplyPicker && (
        <EntityPickerPanel
          mode="picker"
          open={showApplyPicker}
          onOpenChange={setShowApplyPicker}
          entityType="job_openings"
          pickerConfig={{
            entityType: 'job_openings',
            selectionMode: 'single',
            submitUrl: '/applications',
            fieldMapping: { candidateId: ':id', jobOpeningId: ':selectedId' },
            existingCheck: {
              listUrl: '/applications',
              filterField: 'candidateId',
              matchField: 'jobOpeningId',
              label: 'Already applied',
              disableSelection: true,
            },
          }}
          sourceId={item.id as string}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['candidates'] });
            queryClient.invalidateQueries({ queryKey: ['candidates', id, 'applications'] });
          }}
        />
      )}
    </div>
  );
}
