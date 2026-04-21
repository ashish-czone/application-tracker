/**
 * UI-side types for the menus admin package. Frontend defines its own
 * shapes rather than importing from the API package — the API is the
 * boundary. Keep these mirrored by hand against the wire shape.
 */

export type LinkType = 'url' | 'page';
export type Target = '_self' | '_blank';

export interface MenuRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
}

export interface MenuItemRecord {
  id: string;
  menuId: string;
  label: string;
  linkType: LinkType;
  url: string | null;
  pageId: string | null;
  target: Target;
  parentId: string | null;
  depth: number;
  sortOrder: number;
  createdAt: string;
}

export interface CreateMenuItemInput {
  menuId: string;
  label: string;
  linkType: LinkType;
  url?: string | null;
  pageId?: string | null;
  target: Target;
  parentId?: string | null;
}

export interface UpdateMenuItemInput {
  label?: string;
  linkType?: LinkType;
  url?: string | null;
  pageId?: string | null;
  target?: Target;
}

export interface MoveMenuItemInput {
  parentId?: string | null;
  sortOrder?: number;
}

export interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; limit: number };
}

export interface PageLite {
  id: string;
  title: string;
  slug: string;
}
