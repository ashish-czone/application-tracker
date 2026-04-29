import { Suspense } from 'react';
import { Route } from 'react-router';
import { EntityCreatePage, EntityDetailPage, EntityEditPage } from '@packages/entity-engine-ui';
import { UsersListPage } from './pages/UsersListPage';

const PageFallback = () => (
  <div className="space-y-4 p-1">
    <div className="h-6 w-48 animate-pulse rounded bg-muted" />
    <div className="h-4 w-72 animate-pulse rounded bg-muted" />
    <div className="h-64 animate-pulse rounded bg-muted" />
  </div>
);

export const usersRoutes = (
  <Route path="/users">
    <Route
      index
      element={<Suspense fallback={<PageFallback />}><UsersListPage /></Suspense>}
    />
    <Route
      path="new"
      element={<Suspense fallback={<PageFallback />}><EntityCreatePage entityType="users" /></Suspense>}
    />
    <Route
      path=":id"
      element={<Suspense fallback={<PageFallback />}><EntityDetailPage entityType="users" /></Suspense>}
    />
    <Route
      path=":id/edit"
      element={<Suspense fallback={<PageFallback />}><EntityEditPage entityType="users" /></Suspense>}
    />
  </Route>
);
