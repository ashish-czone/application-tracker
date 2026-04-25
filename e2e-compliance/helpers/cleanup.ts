import { apiClient } from './api-client';

/**
 * Map from entity kind → controller path. Used by CleanupTracker.flush
 * to issue DELETE requests against the right route.
 */
const ENTITY_PATHS: Record<string, string> = {
  client: 'clients',
  'client-contact': 'client-contacts',
  'client-registration': 'client-registrations',
  filing: 'compliance-filings',
  rule: 'compliance-rules',
  law: 'laws',
  'law-handler': 'law-handlers',
  organization: 'organizations',
  user: 'users',
  'org-unit': 'org-units',
  'org-position': 'org-positions',
};

interface TrackedEntity {
  kind: keyof typeof ENTITY_PATHS | string;
  id: string;
}

/**
 * Per-spec scratchpad of entities created via the API during setup so they
 * can be deleted in afterAll. Tests that create entities through the UI
 * should also call `track()` with the new ID parsed from the URL or
 * response.
 *
 * Cleanup runs in reverse order so child entities (filings, registrations)
 * are deleted before their parents (clients, laws).
 *
 * Failures during cleanup are logged but never thrown — a half-cleaned-up
 * suite is preferable to a green test that masks a teardown bug.
 */
export class CleanupTracker {
  private items: TrackedEntity[] = [];

  track(kind: TrackedEntity['kind'], id: string): void {
    this.items.push({ kind, id });
  }

  size(): number {
    return this.items.length;
  }

  async flush(): Promise<void> {
    const reversed = [...this.items].reverse();
    this.items = [];

    for (const { kind, id } of reversed) {
      const basePath = ENTITY_PATHS[kind];
      if (!basePath) {
        console.warn(`[e2e-cleanup] no path mapping for kind="${kind}"; skipping ${id}`);
        continue;
      }
      try {
        await apiClient.delete(`/${basePath}/${id}`);
      } catch (err) {
        console.warn(
          `[e2e-cleanup] failed to delete ${kind}:${id} — ${(err as Error).message}`,
        );
      }
    }
  }
}
