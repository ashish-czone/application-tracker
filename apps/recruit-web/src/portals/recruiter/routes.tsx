import { lazy } from 'react';

export const CandidatesListPage = lazy(
  () => import('./features/candidates/pages/CandidatesListPage'),
);

export const CandidateDetailPage = lazy(
  () => import('./features/candidates/pages/CandidateDetailPage'),
);

export const SettingsPage = lazy(
  () => import('./features/settings/pages/SettingsPage'),
);
