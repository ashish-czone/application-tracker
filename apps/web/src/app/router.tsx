import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { AppLayout } from './layout/AppLayout';
import { AuthGuard } from '@packages/auth-ui/components/AuthGuard';
import { UsersListPage, RolesListPage, WorkflowsListPage, WorkflowEditorPage, AutomationsPage, RuleBuilderPage, SettingsPage, TagGroupsListPage, CategoryGroupsListPage, OrgPositionsPage, OrgUnitsPage } from '../portals/customer/routes';
import { EntityListPage, EntityDetailPage } from '@packages/entity-engine-ui';

const LoginPage = lazy(() => import('@packages/auth-ui/pages/LoginPage'));
const RegisterPage = lazy(() => import('@packages/auth-ui/pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@packages/auth-ui/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@packages/auth-ui/pages/ResetPasswordPage'));
const ProfilePage = lazy(() => import('@packages/auth-ui/pages/ProfilePage'));
const OAuthCallbackPage = lazy(() => import('@packages/auth-ui/pages/OAuthCallbackPage'));

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
      {/* Public routes */}
      <Route path="/login" element={<Suspense fallback={null}><LoginPage /></Suspense>} />
      <Route path="/register" element={<Suspense fallback={null}><RegisterPage /></Suspense>} />
      <Route path="/forgot-password" element={<Suspense fallback={null}><ForgotPasswordPage /></Suspense>} />
      <Route path="/reset-password" element={<Suspense fallback={null}><ResetPasswordPage /></Suspense>} />
      <Route path="/oauth/callback" element={<Suspense fallback={null}><OAuthCallbackPage /></Suspense>} />

      {/* Protected routes */}
      <Route element={<AuthGuard />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route
            path="/profile"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <ProfilePage />
              </Suspense>
            }
          />
          <Route
            path="/users"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <UsersListPage />
              </Suspense>
            }
          />
          <Route
            path="/roles"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <RolesListPage />
              </Suspense>
            }
          />
          <Route
            path="/org-units"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <OrgUnitsPage />
              </Suspense>
            }
          />
          <Route
            path="/org-positions"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <OrgPositionsPage />
              </Suspense>
            }
          />
          <Route path="/tasks">
            <Route
              index
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <EntityListPage entityType="tasks" />
                </Suspense>
              }
            />
            <Route
              path=":id"
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <EntityDetailPage entityType="tasks" />
                </Suspense>
              }
            />
          </Route>
          <Route
            path="/workflows"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <WorkflowsListPage />
              </Suspense>
            }
          />
          <Route
            path="/workflows/:slug"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <WorkflowEditorPage />
              </Suspense>
            }
          />
          <Route
            path="/automations"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <AutomationsPage />
              </Suspense>
            }
          />
          <Route
            path="/automations/create"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <RuleBuilderPage />
              </Suspense>
            }
          />
          <Route
            path="/automations/:id/edit"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <RuleBuilderPage />
              </Suspense>
            }
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
            path="/settings"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <SettingsPage />
              </Suspense>
            }
          />
        </Route>
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
