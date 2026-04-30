export const DIRECTORY_PERMISSIONS = {
  /** Read directory records (search/list clients & client_contacts via picker). */
  READ: 'directory.read',
  /** Merge two records (clients or client_contacts) — ops only. */
  MERGE: 'directory.merge',
  /** Cross-tenant search across all directory records — ops only. Reserved for v2. */
  GLOBAL_SEARCH: 'directory.search.global',
} as const;

export type DirectoryPermission =
  (typeof DIRECTORY_PERMISSIONS)[keyof typeof DIRECTORY_PERMISSIONS];
