import { useMemo } from 'react';
import { Link } from 'react-router';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from 'recharts';
import {
  Briefcase, Users, CalendarCheck, FileText,
  ArrowUpRight, Clock, TrendingUp, Filter,
} from 'lucide-react';
import { useAuth } from '@packages/auth-ui/hooks/useAuth';
import { formatLabel, formatDateShort } from '@packages/common';
import { useJobOpeningsCount } from '@domains/recruit-ui/hooks/useJobOpeningsApi';
import { useCandidatesCount } from '@domains/recruit-ui/hooks/useCandidatesApi';
import { useInterviewsCount, useUpcomingInterviews } from '@domains/recruit-ui/hooks/useInterviewsApi';
import { useAllApplications } from '@domains/recruit-ui/hooks/useApplicationsApi';

interface MetricCardProps {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  color: string;
  bgColor: string;
}

function MetricCard({ label, value, icon: Icon, href, color, bgColor }: MetricCardProps) {
  return (
    <Link
      to={href}
      className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 hover:border-primary/20 hover:shadow-sm transition-all"
    >
      <div className={`h-12 w-12 rounded-xl ${bgColor} flex items-center justify-center shrink-0`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-semibold text-foreground tabular-nums">{value}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
      </div>
      <ArrowUpRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors shrink-0" />
    </Link>
  );
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

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

const STAGE_CHART_COLORS: Record<string, string> = {
  'new': '#6b7280',
  'phone-screen': '#3b82f6',
  'technical': '#8b5cf6',
  'on-site': '#f59e0b',
  'final': '#ec4899',
  'offer': '#10b981',
  'hired': '#059669',
  'rejected': '#ef4444',
  'withdrawn': '#9ca3af',
};

const PIPELINE_STAGE_ORDER = ['new', 'phone-screen', 'technical', 'on-site', 'final', 'offer', 'hired'];

const SOURCE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#f97316', '#6366f1'];

export function DashboardPage() {
  const { user } = useAuth();

  // Fetch counts
  const { data: jobsData } = useJobOpeningsCount();
  const { data: candidatesData } = useCandidatesCount();
  const { data: interviewsData } = useInterviewsCount();

  // Fetch all applications for charts
  const { data: allApplicationsData } = useAllApplications();

  const applications = allApplicationsData?.data ?? [];
  const applicationCount = allApplicationsData?.meta?.total ?? 0;

  // Pipeline funnel data
  const pipelineFunnel = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const app of applications) {
      counts[app.stage] = (counts[app.stage] ?? 0) + 1;
    }
    return PIPELINE_STAGE_ORDER
      .filter((stage) => (counts[stage] ?? 0) > 0)
      .map((stage) => ({
        stage: formatLabel(stage),
        stageKey: stage,
        count: counts[stage] ?? 0,
      }));
  }, [applications]);

  // Source breakdown data
  const sourceBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const app of applications) {
      const src = app.source || 'unknown';
      counts[src] = (counts[src] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([source, count]) => ({
        source: formatLabel(source),
        count,
      }));
  }, [applications]);

  // Recent applications (top 5 by date)
  const recentApps = useMemo(() => {
    return [...applications]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [applications]);

  // Fetch upcoming interviews
  const { data: upcomingInterviews } = useUpcomingInterviews();

  const jobCount = jobsData?.meta?.total ?? 0;
  const candidateCount = candidatesData?.meta?.total ?? 0;
  const interviewCount = interviewsData?.meta?.total ?? 0;

  // Conversion rates
  const hiredCount = applications.filter((a) => a.stage === 'hired').length;
  const conversionRate = applicationCount > 0 ? Math.round((hiredCount / applicationCount) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of your recruiting pipeline</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Open Positions"
          value={jobCount}
          icon={Briefcase}
          href="/job-openings"
          color="text-blue-600"
          bgColor="bg-blue-50"
        />
        <MetricCard
          label="Candidates"
          value={candidateCount}
          icon={Users}
          href="/candidates"
          color="text-violet-600"
          bgColor="bg-violet-50"
        />
        <MetricCard
          label="Applications"
          value={applicationCount}
          icon={FileText}
          href="/applications"
          color="text-emerald-600"
          bgColor="bg-emerald-50"
        />
        <MetricCard
          label="Interviews"
          value={interviewCount}
          icon={CalendarCheck}
          href="/interviews"
          color="text-amber-600"
          bgColor="bg-amber-50"
        />
      </div>

      {/* Charts row */}
      {applications.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Pipeline funnel */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Pipeline Funnel</h2>
              <span className="text-xs text-muted-foreground ml-auto">{conversionRate}% conversion</span>
            </div>
            <div className="px-5 py-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={pipelineFunnel} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="stage"
                    width={100}
                    tick={{ fontSize: 12, fill: 'var(--muted-foreground, #6b7280)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid var(--border, #e5e7eb)',
                      backgroundColor: 'var(--card, #fff)',
                      fontSize: '12px',
                    }}
                    formatter={(value) => [value, 'Applications']}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                    {pipelineFunnel.map((entry) => (
                      <Cell key={entry.stageKey} fill={STAGE_CHART_COLORS[entry.stageKey] ?? '#6b7280'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Source breakdown */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Source Effectiveness</h2>
            </div>
            <div className="px-5 py-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={sourceBreakdown} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                  <XAxis
                    dataKey="source"
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground, #6b7280)' }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid var(--border, #e5e7eb)',
                      backgroundColor: 'var(--card, #fff)',
                      fontSize: '12px',
                    }}
                    formatter={(value) => [value, 'Applications']}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={28}>
                    {sourceBreakdown.map((_, i) => (
                      <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Two-column layout: recent apps + upcoming interviews */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent applications */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Recent Applications</h2>
            </div>
            <Link to="/applications" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-border">
            {recentApps.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                No applications yet
              </div>
            ) : (
              recentApps.map((app) => (
                <Link
                  key={app.id}
                  to={`/applications/${app.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {app.candidateId__label || 'Candidate'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {app.jobOpeningId__label || 'Job'} &middot; {formatDateShort(app.createdAt)}
                    </p>
                  </div>
                  <span className={`shrink-0 ml-3 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STAGE_COLORS[app.stage] ?? 'bg-gray-100 text-gray-700'}`}>
                    {formatLabel(app.stage)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Upcoming interviews */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Upcoming Interviews</h2>
            </div>
            <Link to="/interviews" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-border">
            {(!upcomingInterviews?.data || upcomingInterviews.data.length === 0) ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                No upcoming interviews
              </div>
            ) : (
              upcomingInterviews.data.map((interview) => (
                <Link
                  key={interview.id}
                  to={`/interviews/${interview.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {interview.candidateId__label || 'Candidate'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {interview.interviewName} &middot; {interview.jobOpeningId__label || 'Job'}
                    </p>
                  </div>
                  <div className="shrink-0 ml-3 text-right">
                    <p className="text-xs font-medium text-foreground">{formatDateShort(interview.interviewFrom)}</p>
                    <p className="text-xs text-muted-foreground">{formatTime(interview.interviewFrom)}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
