import { lazy } from 'react';
import type { RouteObject } from 'react-router';
import { LayoutDashboard } from 'lucide-react';
import type {
  DomainWebManifest,
  DomainDetailPageComponent,
  MenuItem,
} from '@packages/domains';
import { EntityCreatePage } from '@packages/entity-engine-ui';
import { CANDIDATES_UI_CONFIG } from './entities/candidates.config';
import { OFFERS_UI_CONFIG } from './entities/offers.config';

const DashboardPage = lazy(() =>
  import('./portals/recruiter/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const TemplatesPage = lazy(() =>
  import('./portals/recruiter/features/templates/TemplatesPage').then((m) => ({ default: m.TemplatesPage })),
);
const InterviewsCalendarPage = lazy(() =>
  import('./portals/recruiter/features/interviews/InterviewsCalendarPage').then((m) => ({ default: m.InterviewsCalendarPage })),
);
const CandidateProfilePage = lazy(() =>
  import('./portals/recruiter/features/candidates/CandidateProfilePage').then((m) => ({ default: m.CandidateProfilePage })),
);
const JobOpeningDetailPage = lazy(() =>
  import('./portals/recruiter/features/job-openings/JobOpeningDetailPage').then((m) => ({ default: m.JobOpeningDetailPage })),
);
const ApplicationDetailPage = lazy(() =>
  import('./portals/recruiter/features/applications/ApplicationDetailPage').then((m) => ({ default: m.ApplicationDetailPage })),
);

const routes: RouteObject[] = [
  { path: '/', element: <DashboardPage /> },
  { path: '/templates', element: <TemplatesPage /> },
  { path: '/job-openings/new', element: <EntityCreatePage entityType="job_openings" /> },
  { path: '/interviews/calendar', element: <InterviewsCalendarPage /> },
];

const detailPageOverrides: Record<string, DomainDetailPageComponent> = {
  candidates: CandidateProfilePage as unknown as DomainDetailPageComponent,
  job_openings: JobOpeningDetailPage as unknown as DomainDetailPageComponent,
  applications: ApplicationDetailPage as unknown as DomainDetailPageComponent,
};

const menuItems: MenuItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, position: 'before' },
];

const entityUIConfigs = [CANDIDATES_UI_CONFIG, OFFERS_UI_CONFIG];

export const recruitWeb: DomainWebManifest = {
  name: 'recruit',
  displayName: 'Recruit',
  routes,
  detailPageOverrides,
  menuItems,
  entityUIConfigs,
};
