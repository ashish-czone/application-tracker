import { Suspense, type ReactNode } from 'react';
import { Routes, Route } from 'react-router';
import { useEntityEngine } from './EntityEngineProvider';
import { EntityListPage } from './pages/EntityListPage';
import { EntityCreatePage } from './pages/EntityCreatePage';
import { EntityDetailPage } from './pages/EntityDetailPage';

interface EntityRouterProps {
  /** Non-entity routes (Dashboard, Settings, etc.) rendered alongside entity routes */
  extraRoutes?: ReactNode;
  /** Loading fallback for lazy-loaded pages */
  fallback?: ReactNode;
}

const DefaultFallback = () => (
  <div className="space-y-4 p-1">
    <div className="h-6 w-48 animate-pulse rounded bg-muted" />
    <div className="h-4 w-72 animate-pulse rounded bg-muted" />
    <div className="h-64 animate-pulse rounded bg-muted" />
  </div>
);

/**
 * Auto-generates routes for all registered entities.
 * For each entity in the registry, creates:
 * - /{slug}      → EntityListPage
 * - /{slug}/:id  → EntityDetailPage
 *
 * Use `extraRoutes` to add non-entity routes (Dashboard, Settings, etc.)
 * alongside the auto-generated ones.
 */
export function EntityRouter({ extraRoutes, fallback }: EntityRouterProps) {
  const { entities, isLoading } = useEntityEngine();

  if (isLoading) {
    return fallback ?? <DefaultFallback />;
  }

  return (
    <Routes>
      {/* Extra routes (Dashboard, Settings, etc.) */}
      {extraRoutes}

      {/* Auto-generated entity routes */}
      {entities.map((entity) => (
        <Route key={entity.entityType} path={`/${entity.slug}`}>
          <Route
            index
            element={
              <Suspense fallback={fallback ?? <DefaultFallback />}>
                <EntityListPage entityType={entity.entityType} />
              </Suspense>
            }
          />
          <Route
            path="new"
            element={
              <Suspense fallback={fallback ?? <DefaultFallback />}>
                <EntityCreatePage entityType={entity.entityType} />
              </Suspense>
            }
          />
          <Route
            path=":id"
            element={
              <Suspense fallback={fallback ?? <DefaultFallback />}>
                <EntityDetailPage entityType={entity.entityType} />
              </Suspense>
            }
          />
        </Route>
      ))}
    </Routes>
  );
}
