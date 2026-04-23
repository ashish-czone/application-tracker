export const AUDIT_PERMISSIONS = {
  /** Firm-wide audit read. Required for queries that aren't scoped to a single entity. */
  READ_ALL: 'audit.read_all',
} as const;
