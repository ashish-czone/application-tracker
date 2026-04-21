/**
 * Wire shape returned by GET /public/menus/:slug. Kept local — the
 * frontend package has no backend deps; the API is the boundary.
 */

export type PublicLinkType = 'url' | 'page';
export type PublicTarget = '_self' | '_blank';

export interface PublicMenuItemDto {
  id: string;
  label: string;
  linkType: PublicLinkType;
  url: string | null;
  pageId: string | null;
  /** Ready-to-render href resolved by the backend: the raw url, or `/<pageSlug>` for page links, or null if the referenced page is missing. */
  href: string | null;
  target: PublicTarget;
  children: PublicMenuItemDto[];
}

export interface PublicMenuResponse {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  items: PublicMenuItemDto[];
}
