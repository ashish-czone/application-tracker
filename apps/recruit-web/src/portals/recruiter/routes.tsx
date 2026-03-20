import { lazy } from 'react';

export const CandidatesListPage = lazy(
  () => import('./features/candidates/pages/CandidatesListPage'),
);
