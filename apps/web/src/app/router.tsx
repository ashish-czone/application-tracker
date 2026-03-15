import { Routes, Route } from 'react-router';
import { AppLayout } from './layout/AppLayout';

function DashboardPage() {
  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">Welcome back</p>
      </div>
    </div>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
      </Route>
    </Routes>
  );
}
