import { Tags, FolderTree } from 'lucide-react';
import type { WebFeatureManifest } from '@packages/domains';
import { TaxonomyProvider } from './TaxonomyProvider';
import { TagGroupsListPage } from './pages/TagGroupsListPage';
import { CategoryGroupsListPage } from './pages/CategoryGroupsListPage';
import { tagsHeaderPlugin } from './plugins';

/**
 * Frontend manifest for the taxonomy addon. Wires the TaxonomyProvider into
 * the app shell, mounts admin routes for tag groups + category groups, adds
 * sidebar entries under the platform Management group, and registers the
 * tags header plugin so detail pages render an inline chip row when a tags
 * feature is configured on the entity.
 */
export const taxonomyWeb: WebFeatureManifest = {
  name: 'taxonomy',
  provider: TaxonomyProvider,
  routes: [
    { path: '/tag-groups', element: <TagGroupsListPage /> },
    { path: '/categories', element: <CategoryGroupsListPage /> },
  ],
  menuItems: [
    {
      path: '/tag-groups',
      label: 'Tag Groups',
      icon: Tags,
      permission: 'taxonomy.tag-groups.read',
      parent: '/management',
    },
    {
      path: '/categories',
      label: 'Categories',
      icon: FolderTree,
      permission: 'taxonomy.categories.read',
      parent: '/management',
    },
  ],
  headerPlugins: [tagsHeaderPlugin],
};
