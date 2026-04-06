import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import {
  Briefcase, Users, CalendarCheck, FileText,
  ArrowUpRight, Clock, TrendingUp,
} from 'lucide-react';
import { api } from '../../../../lib/api';
import { useAuth } from '@packages/platform-ui/auth/hooks/useAuth';

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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatLabel(value: string): string {
  return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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

export function DashboardPage() {
  const { user } = useAuth();

  // Fetch counts
  const { data: jobsData } = useQuery({
    queryKey: ['dashboard', 'jobs'],
    queryFn: () => api.get<{ meta: { total: number } }>('/job-openings?limit=1'),
  });

  const { data: candidatesData } = useQuery({
    queryKey: ['dashboard', 'candidates'],
    queryFn: () => api.get<{ meta: { total: number } }>('/candidates?limit=1'),
  });

  const { data: applicationsData } = useQuery({
    queryKey: ['dashboard', 'applications'],
    queryFn: () => api.get<{ meta: { total: number } }>('/applications?limit=1'),
  });

  const { data: interviewsData } = useQuery({
    queryKey: ['dashboard', 'interviews'],
    queryFn: () => api.get<{ meta: { total: number } }>('/interviews?limit=1'),
  });

  // Fetch recent applications with details
  const { data: recentApps } = useQuery({
    queryKey: ['dashboard', 'recent-applications'],
    queryFn: () => api.get<{ data: { id: string; candidateId__label: string; jobOpeningId__label: string; stage: string; createdAt: string }[] }>('/applications?limit=5&sort=createdAt&order=desc'),
  });

  // Fetch upcoming interviews
  const { data: upcomingInterviews } = useQuery({
    queryKey: ['dashboard', 'upcoming-interviews'],
    queryFn: () => api.get<{ data: { id: string; interviewName: string; candidateId__label: string; jobOpeningId__label: string; interviewFrom: string; status: string }[] }>('/interviews?limit=5&sort=interviewFrom&order=asc&status=scheduled'),
  });

  const jobCount = jobsData?.meta?.total ?? 0;
  const candidateCount = candidatesData?.meta?.total ?? 0;
  const applicationCount = applicationsData?.meta?.total ?? 0;
  const interviewCount = interviewsData?.meta?.total ?? 0;

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

      {/* Two-column layout */}
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
            {(!recentApps?.data || recentApps.data.length === 0) ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                No applications yet
              </div>
            ) : (
              recentApps.data.map((app) => (
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
                      {app.jobOpeningId__label || 'Job'} &middot; {formatDate(app.createdAt)}
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
                    <p className="text-xs font-medium text-foreground">{formatDate(interview.interviewFrom)}</p>
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
