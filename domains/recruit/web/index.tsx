import { lazy } from 'react';
import type { RouteObject } from 'react-router';
import type { DomainWebManifest, DomainDetailPageComponent } from '@packages/domains';
import { EntityCreatePage } from '@packages/entity-engine-ui';

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

export const recruitWeb: DomainWebManifest = {
  name: 'recruit',
  displayName: 'Recruit',
  routes,
  detailPageOverrides,
};
