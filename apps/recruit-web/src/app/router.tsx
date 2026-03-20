import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { AppLayout } from './layout/AppLayout';
import { AuthGuard } from '../shared/auth/components/AuthGuard';
import { CandidatesListPage } from '../portals/recruiter/routes';

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
            element={
              <Suspense fallback={<PageSkeleton />}>
                <ProfilePage />
              </Suspense>
            }
          />
          <Route
            path="/candidates"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <CandidatesListPage />
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
