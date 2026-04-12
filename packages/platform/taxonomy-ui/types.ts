export interface EntityTag {
  id: string;
  name: string;
  slug: string;
  color?: string | null;
  tagGroupId: string;
  groupName: string;
  groupSlug: string;
}

export interface TagOption {
  value: string;
  label: string;
  color?: string;
}

/**
 * Structural ApiFn type matching @packages/platform-ui/PlatformUIProvider.
 * Duplicated here to avoid a platform-ui → entity-engine-ui → taxonomy-ui cycle.
 */
export interface ApiFn {
  get: <T>(path: string) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
  patch: <T>(path: string, body?: unknown) => Promise<T>;
  put: <T>(path: string, body?: unknown) => Promise<T>;
  delete: <T>(path: string) => Promise<T>;
}
