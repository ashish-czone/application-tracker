import { useMemo } from 'react';
import { NavLink } from 'react-router';
import * as Icons from 'lucide-react';
import { ArrowRight, Sparkles, type LucideIcon } from 'lucide-react';
import { useEntityEngine } from '@packages/entity-engine-ui';
import { useAuth } from '@packages/auth-ui/hooks/useAuth';

interface DashboardPageProps {
  brandLabel: string;
}

function resolveIcon(name: string): LucideIcon {
  const pascal = name
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
  return (Icons as unknown as Record<string, LucideIcon>)[pascal] ?? Icons.Database;
}

export function DashboardPage({ brandLabel }: DashboardPageProps) {
  const { entities } = useEntityEngine();
  const { user } = useAuth();

  const sortedEntities = useMemo(
    () =>
      [...entities].sort((a, b) => {
        const orderA = a.ui.navOrder ?? 99;
        const orderB = b.ui.navOrder ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.pluralName.localeCompare(b.pluralName);
      }),
    [entities],
  );

  const greeting = user?.userType
    ? `Welcome back, ${user.userType.charAt(0).toUpperCase()}${user.userType.slice(1)}`
    : 'Welcome back';

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          {brandLabel}
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          {greeting}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Jump into your data or pick up where you left off.
        </p>
      </div>

      {sortedEntities.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Entities
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sortedEntities.map((entity) => {
              const Icon = resolveIcon(entity.ui.icon);
              return (
                <NavLink
                  key={entity.entityType}
                  to={`/${entity.slug}`}
                  className="group flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-sm transition-colors hover:border-ring/40 hover:bg-accent/40"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/[0.08] text-primary">
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1 truncate font-medium text-foreground">
                    {entity.pluralName}
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </NavLink>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
