import { useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useEntityEngine } from '../EntityEngineProvider';
import { groupSlug } from '../helpers/groupSlug';
import { EntityListPage } from './EntityListPage';
import type { EntityRegistryEntry } from '../types';

interface EntityGroupPageProps {
  /**
   * URL slug of the nav group (lowercased / dashed form of the `navGroup`
   * label — e.g. `'content'` for `navGroup: 'Content'`).
   */
  groupSlugPath: string;
}

/**
 * Tabbed container for all entities sharing a `navGroup` + `groupRenderMode: 'tabs'`.
 *
 * - One tab per entity, ordered by `ui.navOrder` then plural name.
 * - Active tab is driven by the URL path segment after the group slug
 *   (e.g. `/content/testimonials` → testimonials tab).
 * - Landing on the group root (`/content`) redirects to the first entity's tab.
 * - Each tab embeds the existing auto-generated `EntityListPage`, so the
 *   detail/create affordances inside the list work unchanged.
 *
 * Entity detail routes (`/{groupSlug}/{entitySlug}/:id`) are mounted
 * separately in the router and render full-screen outside the tabs.
 */
export function EntityGroupPage({ groupSlugPath }: EntityGroupPageProps) {
  const { entities, isLoading } = useEntityEngine();
  const { entitySlug } = useParams<{ entitySlug?: string }>();
  const navigate = useNavigate();

  const grouped = useMemo<EntityRegistryEntry[]>(() => {
    return [...entities]
      .filter(
        (e) =>
          e.ui?.groupRenderMode === 'tabs' &&
          e.ui?.navGroup !== undefined &&
          groupSlug(e.ui.navGroup) === groupSlugPath,
      )
      .sort((a, b) => {
        const orderA = a.ui?.navOrder ?? 99;
        const orderB = b.ui?.navOrder ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        return a.pluralName.localeCompare(b.pluralName);
      });
  }, [entities, groupSlugPath]);

  const activeEntity = entitySlug
    ? grouped.find((e) => e.slug === entitySlug)
    : undefined;

  useEffect(() => {
    if (isLoading || grouped.length === 0) return;
    if (!entitySlug) {
      navigate(`/${groupSlugPath}/${grouped[0].slug}`, { replace: true });
      return;
    }
    if (!activeEntity) {
      navigate(`/${groupSlugPath}/${grouped[0].slug}`, { replace: true });
    }
  }, [isLoading, grouped, entitySlug, activeEntity, groupSlugPath, navigate]);

  if (isLoading) return null;

  if (grouped.length === 0) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        No entities are registered under this group.
      </div>
    );
  }

  const current = activeEntity ?? grouped[0];
  const groupLabel = current.ui?.navGroup ?? groupSlugPath;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">{groupLabel}</h1>
      </div>
      <div className="border-b px-6">
        <nav className="flex gap-0 -mb-px">
          {grouped.map((entity) => {
            const isActive = entity.slug === current.slug;
            return (
              <button
                key={entity.entityType}
                type="button"
                onClick={() => navigate(`/${groupSlugPath}/${entity.slug}`)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                }`}
              >
                {entity.pluralName}
              </button>
            );
          })}
        </nav>
      </div>
      <div className="flex-1 overflow-auto">
        <EntityListPage entityType={current.entityType} />
      </div>
    </div>
  );
}
