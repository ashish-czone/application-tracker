import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { AppLayout } from './layout/AppLayout';
import { AuthGuard } from '../shared/auth/components/AuthGuard';
import { EntityListPage, EntityCreatePage, EntityDetailPage } from '@packages/entity-engine-ui';
import { SettingsPage, AutomationsPage, RuleBuilderPage, UsersListPage, RolesListPage, TagGroupsListPage, CategoryGroupsListPage } from '../portals/recruiter/routes';

const LoginPage = lazy(() => import('../shared/auth/pages/LoginPage'));
const RegisterPage = lazy(() => import('../shared/auth/pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('../shared/auth/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('../shared/auth/pages/ResetPasswordPage'));
const ProfilePage = lazy(() => import('../shared/auth/pages/ProfilePage'));

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

/**
 * Entity routes rendered via the engine's generic pages.
 * Each entity gets /{slug} (list) and /{slug}/:id (detail) automatically.
 * Adding a new entity here = 2 lines.
 */
function EntityRoutes({ entityType }: { entityType: string }) {
  return (
    <>
      <Route path={`/${entityType}`} element={<EntityListPage entityType={entityType} />} />
      <Route path={`/${entityType}/:id`} element={<EntityDetailPage entityType={entityType} />} />
    </>
  );
}

export function AppRouter() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Suspense fallback={null}><LoginPage /></Suspense>} />
      <Route path="/register" element={<Suspense fallback={null}><RegisterPage /></Suspense>} />
      <Route path="/forgot-password" element={<Suspense fallback={null}><ForgotPasswordPage /></Suspense>} />
      <Route path="/reset-password" element={<Suspense fallback={null}><ResetPasswordPage /></Suspense>} />

      {/* Protected routes */}
      <Route element={<AuthGuard />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route
            path="/profile"
            element={<Suspense fallback={<PageSkeleton />}><ProfilePage /></Suspense>}
          />

          {/* Entity engine routes — each entity = 2 lines */}
          <Route path="/job-openings" element={<EntityListPage entityType="job_openings" />} />
          <Route path="/job-openings/new" element={<EntityCreatePage entityType="job_openings" />} />
          <Route path="/job-openings/:id" element={<EntityDetailPage entityType="job_openings" />} />
          <Route path="/candidates" element={<EntityListPage entityType="candidates" />} />
          <Route path="/candidates/:id" element={<EntityDetailPage entityType="candidates" />} />
          <Route path="/interviews" element={<EntityListPage entityType="interviews" />} />
          <Route path="/interviews/:id" element={<EntityDetailPage entityType="interviews" />} />
          <Route path="/clients" element={<EntityListPage entityType="clients" />} />
          <Route path="/clients/:id" element={<EntityDetailPage entityType="clients" />} />
          <Route path="/contacts" element={<EntityListPage entityType="contacts" />} />
          <Route path="/contacts/:id" element={<EntityDetailPage entityType="contacts" />} />
          <Route path="/vendors" element={<EntityListPage entityType="vendors" />} />
          <Route path="/vendors/:id" element={<EntityDetailPage entityType="vendors" />} />
          <Route path="/applications" element={<EntityListPage entityType="applications" />} />
          <Route path="/applications/:id" element={<EntityDetailPage entityType="applications" />} />

          {/* Non-entity routes */}
          <Route
            path="/users"
            element={<Suspense fallback={<PageSkeleton />}><UsersListPage /></Suspense>}
          />
          <Route
            path="/roles"
            element={<Suspense fallback={<PageSkeleton />}><RolesListPage /></Suspense>}
          />
          <Route
            path="/tag-groups"
            element={<TagGroupsListPage />}
          />
          <Route
            path="/categories"
            element={<CategoryGroupsListPage />}
          />
          <Route
            path="/settings/:entityType?"
            element={<Suspense fallback={<PageSkeleton />}><SettingsPage /></Suspense>}
          />
          <Route
            path="/automations"
            element={<Suspense fallback={<PageSkeleton />}><AutomationsPage /></Suspense>}
          />
          <Route
            path="/automations/create"
            element={<Suspense fallback={<PageSkeleton />}><RuleBuilderPage /></Suspense>}
          />
          <Route
            path="/automations/:id/edit"
            element={<Suspense fallback={<PageSkeleton />}><RuleBuilderPage /></Suspense>}
          />
        </Route>
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
