import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router';
import type { ReactNode } from 'react';
import { Toaster } from '@packages/ui';
import { EntityEngineProvider, type ColumnRendererRegistration, type DetailTabPlugin, type RightSidebarPanel } from '@packages/entity-engine-ui';
import { PipelineProgressInline } from '@packages/workflows-ui';
import { TaxonomyProvider } from '@packages/taxonomy-ui';
import { PlatformUIProvider } from '@packages/platform-ui';
import { ThemeProvider } from '@packages/theming-ui';
import { useAuth } from '@packages/auth-ui/hooks/useAuth';
import { AuditTimeline } from '@packages/audit-ui';
import { NotesSection } from '@packages/notes-ui';
import { AttachmentsSection } from '@packages/attachments-ui';
import { EvaluationsSection } from '@packages/evaluations-ui';
import { api } from '../lib/api';
import { SessionExpiredModal } from '@packages/auth-ui/components/SessionExpiredModal';
import { CANDIDATES_UI_CONFIG } from '@domains/recruit-ui/entities/candidates.config';
import { OFFERS_UI_CONFIG } from '@domains/recruit-ui/entities/offers.config';
import { TASKS_UI_CONFIG, TaskAssigneeCell } from '@packages/tasks-ui';
import { AvatarNameCell, createStatusBadgeCell, type StatusColors } from '@packages/ui';

const RECRUIT_STATUS_COLORS: Record<string, StatusColors> = {
  // Candidate statuses
  'new': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  'in-review': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  'qualified': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'unqualified': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' },
  'junk-candidate': { bg: 'bg-gray-50', text: 'text-gray-500', dot: 'bg-gray-400' },
  'contacted': { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  'contact-in-future': { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500' },
  'not-contacted': { bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400' },
  'attempted-to-contact': { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  'reviewed': { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500' },
  // Job opening statuses
  'in-progress': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  'waiting-for-approval': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  'on-hold': { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-400' },
  'filled': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'cancelled': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' },
  'declined': { bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-400' },
  'inactive': { bg: 'bg-gray-50', text: 'text-gray-500', dot: 'bg-gray-400' },
  'submitted-by-client': { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  // Interview statuses
  'scheduled': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  'completed': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'no-show': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' },
  'rescheduled': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  // Application stages
  'phone-screen': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  'technical': { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  'on-site': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  'final': { bg: 'bg-pink-50', text: 'text-pink-700', dot: 'bg-pink-500' },
  'offer': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'hired': { bg: 'bg-green-50', text: 'text-green-800', dot: 'bg-green-600' },
  'rejected': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' },
  'withdrawn': { bg: 'bg-gray-50', text: 'text-gray-500', dot: 'bg-gray-400' },
  // Task statuses
  'open': { bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400' },
  'in_progress': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  'done': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
};

const RecruitStatusBadge = createStatusBadgeCell(RECRUIT_STATUS_COLORS);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

const entityUIConfigs = [CANDIDATES_UI_CONFIG, OFFERS_UI_CONFIG, TASKS_UI_CONFIG];

const detailTabs: DetailTabPlugin[] = [
  { key: 'notes', label: 'Notes', order: 100, component: NotesSection, featureFlag: 'hasNotes' },
  { key: 'attachments', label: 'Attachments', order: 200, component: AttachmentsSection, featureFlag: 'hasAttachments' },
  { key: 'evaluations', label: 'Evaluations', order: 300, component: EvaluationsSection, featureFlag: 'hasEvaluations' },
  { key: 'audit-trail', label: 'Audit Trail', order: 1000, component: AuditTimeline },
];

const rightSidebarPanels: RightSidebarPanel[] = [
  { key: 'notes', label: 'Notes', order: 100, component: NotesSection, featureFlag: 'hasNotes' },
  { key: 'files', label: 'Files', order: 200, component: AttachmentsSection, featureFlag: 'hasAttachments' },
  { key: 'evaluations', label: 'Evaluations', order: 300, component: EvaluationsSection, featureFlag: 'hasEvaluations' },
];

const columnRenderers: Record<string, ColumnRendererRegistration> = {
  PipelineProgressRenderer: { component: PipelineProgressInline },
  StatusBadge: { component: RecruitStatusBadge },
  AvatarNameCell: { component: AvatarNameCell },
  TaskAssigneeCell: { component: TaskAssigneeCell },
};

function AuthGatedThemeProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  return (
    <ThemeProvider apiFn={api} enabled={isAuthenticated}>
      {children}
    </ThemeProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <PlatformUIProvider apiFn={api}>
          <AuthGatedThemeProvider>
            <EntityEngineProvider apiFn={api} entityUIConfigs={entityUIConfigs} detailTabs={detailTabs} rightSidebarPanels={rightSidebarPanels} columnRenderers={columnRenderers}>
              <TaxonomyProvider apiFn={api}>
                {children}
              </TaxonomyProvider>
            </EntityEngineProvider>
          </AuthGatedThemeProvider>
        </PlatformUIProvider>
        <Toaster />
        <SessionExpiredModal />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export { queryClient };
