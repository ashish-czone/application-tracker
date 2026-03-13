import { Routes, Route } from 'react-router';
import { AuthLayout } from './layout/AuthLayout';

function DashboardPlaceholder() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
    </div>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<div>Login</div>} />
        <Route path="/register" element={<div>Register</div>} />
        <Route path="/forgot-password" element={<div>Forgot Password</div>} />
        <Route path="/reset-password" element={<div>Reset Password</div>} />
      </Route>
      <Route path="/" element={<DashboardPlaceholder />} />
    </Routes>
  );
}
