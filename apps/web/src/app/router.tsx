import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router';
import { AuthLayout } from './layout/AuthLayout';
import { AppLayout } from './layout/AppLayout';
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

function DashboardPage() {
  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">Welcome back</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Users', value: '1,284', change: '+12%', up: true },
          { label: 'Active Sessions', value: '342', change: '+8%', up: true },
          { label: 'API Requests', value: '48.2k', change: '-3%', up: false },
          { label: 'Uptime', value: '99.98%', change: '+0.02%', up: true },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl border border-border/60 p-5 shadow-sm hover:shadow-md transition-shadow duration-200"
          >
            <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
            <p className="text-xl font-semibold text-foreground mt-1 tracking-tight">{stat.value}</p>
            <p className={`text-xs mt-1 ${stat.up ? 'text-success' : 'text-destructive'}`}>
              {stat.change} from last month
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 bg-white rounded-xl border border-border/60 shadow-sm">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-medium text-foreground">Recent Activity</h2>
        </div>
        <div>
          {[
            { action: 'New user registered', time: '2m ago' },
            { action: 'Role permissions updated', time: '15m ago' },
            { action: 'API key generated', time: '1h ago' },
            { action: 'System backup completed', time: '3h ago' },
          ].map((item, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-4 py-2.5 border-b border-border last:border-0"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                <span className="text-sm text-foreground">{item.action}</span>
              </div>
              <span className="text-xs text-muted-foreground">{item.time}</span>
            </div>
          ))}
        </div>
      </div>
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
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
