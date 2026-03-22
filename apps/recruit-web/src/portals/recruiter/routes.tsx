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

export const AutomationsPage = lazy(
  () => import('./features/automations/pages/AutomationsPage'),
);

export const RuleBuilderPage = lazy(
  () => import('./features/automations/pages/RuleBuilderPage'),
);
