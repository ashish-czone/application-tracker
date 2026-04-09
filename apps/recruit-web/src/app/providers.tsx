import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router';
import type { ReactNode } from 'react';
import { Toaster } from '@packages/ui';
import { EntityEngineProvider, type ColumnRendererRegistration, type DetailTabPlugin, type RightSidebarPanel } from '@packages/entity-engine-ui';
import { PipelineProgressInline } from '@packages/platform-ui/workflows';
import { TaxonomyProvider } from '@packages/platform-ui-taxonomy';
import { PlatformUIProvider } from '@packages/platform-ui';
import { AuditTimeline } from '@packages/platform-ui/audit';
import { NotesSection } from '@packages/notes-ui';
import { AttachmentsSection } from '@packages/attachments-ui';
import { EvaluationsSection } from '@packages/evaluations-ui';
import { api } from '../lib/api';
import { SessionExpiredModal } from '@packages/platform-ui/auth/components/SessionExpiredModal';
import { CANDIDATES_UI_CONFIG } from '../entities/candidates.config';
import { OFFERS_UI_CONFIG } from '../entities/offers.config';
import { StatusBadgeRenderer } from '../portals/recruiter/features/shared/StatusBadgeRenderer';
import { CandidateNameCell } from '../portals/recruiter/features/shared/CandidateNameCell';

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

const entityUIConfigs = [CANDIDATES_UI_CONFIG, OFFERS_UI_CONFIG];

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
  StatusBadge: { component: StatusBadgeRenderer },
  CandidateNameCell: { component: CandidateNameCell },
};

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <PlatformUIProvider apiFn={api}>
          <EntityEngineProvider apiFn={api} entityUIConfigs={entityUIConfigs} detailTabs={detailTabs} rightSidebarPanels={rightSidebarPanels} columnRenderers={columnRenderers}>
            <TaxonomyProvider apiFn={api}>
              {children}
            </TaxonomyProvider>
          </EntityEngineProvider>
        </PlatformUIProvider>
        <Toaster />
        <SessionExpiredModal />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export { queryClient };
