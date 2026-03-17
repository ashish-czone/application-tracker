import { Suspense } from 'react';
import { Routes, Route } from 'react-router';
import { AppLayout } from './layout/AppLayout';
import { UsersListPage } from '../portals/customer/routes';

function DashboardPage() {
  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">Welcome back</p>
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-4 p-1">
      <div className="h-6 w-48 animate-pulse rounded bg-muted" />
      <div className="h-4 w-72 animate-pulse rounded bg-muted" />
      <div className="h-64 animate-pulse rounded bg-muted" />
    </div>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route
          path="/users"
          element={
            <Suspense fallback={<PageSkeleton />}>
              <UsersListPage />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  );
}
