import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router';
import { AuthLayout } from './layout/AuthLayout';
import { AuthGuard } from '@modules/identity/auth/components/AuthGuard';

const LoginPage = lazy(() =>
  import('@modules/identity/auth/pages/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const RegisterPage = lazy(() =>
  import('@modules/identity/auth/pages/RegisterPage').then((m) => ({ default: m.RegisterPage })),
);
const ForgotPasswordPage = lazy(() =>
  import('@modules/identity/auth/pages/ForgotPasswordPage').then((m) => ({
    default: m.ForgotPasswordPage,
  })),
);
const ResetPasswordPage = lazy(() =>
  import('@modules/identity/auth/pages/ResetPasswordPage').then((m) => ({
    default: m.ResetPasswordPage,
  })),
);

function PageSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

function DashboardPlaceholder() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
    </div>
  );
}

export function AppRouter() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>
        <Route element={<AuthGuard />}>
          <Route path="/" element={<DashboardPlaceholder />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
