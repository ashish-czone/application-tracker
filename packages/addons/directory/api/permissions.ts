export const DIRECTORY_PERMISSIONS = {
  /** Merge two records (companies or people) — ops only. */
  MERGE: 'directory.merge',
  /** Cross-tenant search across all directory records — ops only. Reserved for v2. */
  GLOBAL_SEARCH: 'directory.search.global',
} as const;

export type DirectoryPermission =
  (typeof DIRECTORY_PERMISSIONS)[keyof typeof DIRECTORY_PERMISSIONS];
