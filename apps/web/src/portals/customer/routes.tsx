import { lazy } from 'react';

export const UsersListPage = lazy(
  () => import('./features/users/pages/UsersListPage'),
);
