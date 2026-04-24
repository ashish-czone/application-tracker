/**
 * Standard route paths for an entity-engine-backed resource. Hand-written
 * CRUD controllers in each domain expose the same shape; contracts exposes
 * the path helpers so UI clients build URLs without hand-coding them.
 */
export interface EntityRoutes {
  /** Base resource path (e.g. `/tasks`). */
  base: string;
  /** GET list — same as base. */
  list: string;
  /** GET single. */
  byId: (id: string) => string;
  /** POST create — same as base. */
  create: string;
  /** PATCH update. */
  update: (id: string) => string;
  /** DELETE soft-delete. */
  delete: (id: string) => string;
  /** POST transition on a workflow field. */
  transition: (id: string) => string;
  /** POST clone. */
  clone: (id: string) => string;
  /** POST restore. */
  restore: (id: string) => string;
  /** POST reparent (hierarchical entities only). */
  reparent: (id: string) => string;
  /** GET ancestors (hierarchical entities only). */
  ancestors: (id: string) => string;
  /** GET descendants (hierarchical entities only). */
  descendants: (id: string) => string;
  /** GET list layout config. */
  listLayout: string;
}

export function buildEntityRoutes(slug: string): EntityRoutes {
  const base = `/${slug}`;
  return {
    base,
    list: base,
    byId: (id) => `${base}/${id}`,
    create: base,
    update: (id) => `${base}/${id}`,
    delete: (id) => `${base}/${id}`,
    transition: (id) => `${base}/${id}/transition`,
    clone: (id) => `${base}/${id}/clone`,
    restore: (id) => `${base}/${id}/restore`,
    reparent: (id) => `${base}/${id}/reparent`,
    ancestors: (id) => `${base}/${id}/ancestors`,
    descendants: (id) => `${base}/${id}/descendants`,
    listLayout: `${base}/layout/list`,
  };
}
