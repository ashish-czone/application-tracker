import { Injectable } from '@nestjs/common';

/**
 * Declarative description of a single permission slug. Every permission the
 * platform enforces is declared via a manifest — CRUD permissions synthesized
 * by entity-engine, platform/addon module permissions, and domain permissions
 * for non-entity UI surfaces.
 *
 * The registry is the single source of truth for:
 *  - What permissions exist (role-editor UI lists them grouped by `module`)
 *  - What scopes each permission supports (grant validation rejects any
 *    `ScopeSpec.type` not in `supportedScopes`)
 *  - Human-facing labels/descriptions (role editor, audit surfaces)
 *
 * `supportedScopes` defaults to `['any']` for permissions that are not
 * row-gated (e.g. platform admin verbs). Row-gated permissions must declare
 * the scope types that make sense for the underlying entity — typically a
 * subset of the registered `ScopeResolverRegistry` keys.
 */
export interface PermissionManifest {
  /** Canonical permission slug, e.g. `filings.pickup`. */
  slug: string;
  /** Module grouping, e.g. `filings`. Drives UI grouping + route scoping. */
  module: string;
  /** Action within the module, e.g. `pickup`. Joined with module → slug. */
  action: string;
  /** Short human label for UI, e.g. `Pick up filing`. */
  label: string;
  /** Longer human description for tooltips/help text. */
  description?: string;
  /**
   * Scope type keys valid for this permission. Grants whose `scopes[].type`
   * falls outside this list are rejected at write time. `['any']` means the
   * permission is not row-gated.
   */
  supportedScopes: string[];
}

/**
 * Registry of all declared permission manifests. Populated at module init
 * (entity-engine derives from entity configs; platform/addon/domain modules
 * register their own manifests). Consumed by RbacService for grant
 * validation and by the role-editor controller for discovery.
 *
 * Mirrors `ScopeResolverRegistry`: modules register into it in `onModuleInit`,
 * nothing branches on specific slugs, new permissions land as registrations.
 */
@Injectable()
export class PermissionManifestRegistry {
  private readonly manifests = new Map<string, PermissionManifest>();

  register(manifest: PermissionManifest): void {
    if (this.manifests.has(manifest.slug)) {
      throw new Error(`Permission manifest '${manifest.slug}' is already registered`);
    }
    if (manifest.supportedScopes.length === 0) {
      throw new Error(
        `Permission manifest '${manifest.slug}' must declare at least one supportedScope (use ['any'] for non-row-gated permissions)`,
      );
    }
    this.manifests.set(manifest.slug, manifest);
  }

  registerMany(manifests: PermissionManifest[]): void {
    for (const m of manifests) this.register(m);
  }

  get(slug: string): PermissionManifest | undefined {
    return this.manifests.get(slug);
  }

  has(slug: string): boolean {
    return this.manifests.has(slug);
  }

  list(): PermissionManifest[] {
    return Array.from(this.manifests.values());
  }

  listByModule(module: string): PermissionManifest[] {
    return this.list().filter((m) => m.module === module);
  }

  /**
   * Scope types valid for a given permission slug. Returns `undefined` if the
   * slug is not registered — callers decide whether that's a hard error
   * (e.g. strict grant validation) or a permissive fallback.
   */
  getSupportedScopes(slug: string): string[] | undefined {
    return this.manifests.get(slug)?.supportedScopes;
  }
}
