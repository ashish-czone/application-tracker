import type { PgTable } from 'drizzle-orm/pg-core';
import type { EventRegistryService } from '@packages/events';
import type { RbacService, PermissionManifest } from '@packages/rbac';
import type { LookupResolverService } from '../services/lookup-resolver.service';
import type { AuditExtension } from '../extensions/audit-extension.interface';

/**
 * Reusable, side-effect-only helpers that register an entity's standard
 * platform-tier capabilities (CRUD permissions, domain events, audit hookup,
 * lookup resolver). Called by `entity-engine.module.ts.initializeEntity()`
 * for engine-managed entities, and exported for hand-written domain services
 * that opt out of `defineEntity()` but still want platform discovery (Strip F
 * pattern — see `project_entity_engine_optin_pivot.md`).
 *
 * Each helper takes the dependencies it needs as arguments rather than
 * reaching for a shared service container, so consumers can call them from
 * any DI context (Nest provider, manual wiring, test bootstrap).
 */

// ---------------------------------------------------------------------------
// CRUD permissions
// ---------------------------------------------------------------------------

export interface RegisterEntityCrudPermissionsInput {
  /** URL slug + permission module key (e.g. 'candidates'). */
  slug: string;
  /** Lowercased singular display name (e.g. 'candidate'). */
  singular: string;
  /** Lowercased plural display name (e.g. 'candidates'). */
  plural: string;
  /** Scope kinds the CRUD verbs allow. Derive via `deriveSupportedScopes`. */
  supportedScopes: string[];
  /** Additional verbs beyond CRUD. `supportedScopes` per entry overrides the CRUD default. */
  extraPermissions?: { action: string; description: string; supportedScopes?: string[] }[];
}

/**
 * Register the four CRUD permission manifests (`{slug}.create/read/update/delete`)
 * plus any extra permissions declared by the entity. Idempotent at the RBAC
 * service level — re-registering the same slug is a no-op.
 */
export function registerEntityCrudPermissions(
  rbac: RbacService,
  input: RegisterEntityCrudPermissionsInput,
): void {
  const { slug, singular, plural, supportedScopes, extraPermissions } = input;
  const crudManifests: PermissionManifest[] = [
    { slug: `${slug}.create`, module: slug, action: 'create', label: `Create ${plural}`,   description: `Create ${plural}`,   supportedScopes },
    { slug: `${slug}.read`,   module: slug, action: 'read',   label: `View ${plural}`,     description: `View ${plural}`,     supportedScopes },
    { slug: `${slug}.update`, module: slug, action: 'update', label: `Update ${singular}`, description: `Update ${plural}`,   supportedScopes },
    { slug: `${slug}.delete`, module: slug, action: 'delete', label: `Delete ${singular}`, description: `Delete ${plural}`,   supportedScopes },
  ];
  const extraManifests: PermissionManifest[] = (extraPermissions ?? []).map((p) => ({
    slug: `${slug}.${p.action}`,
    module: slug,
    action: p.action,
    label: p.description,
    description: p.description,
    supportedScopes: p.supportedScopes ?? supportedScopes,
  }));
  rbac.registerManifests([...crudManifests, ...extraManifests]);
}

// ---------------------------------------------------------------------------
// Standard CRUD events (Created / Updated / Deleted)
// ---------------------------------------------------------------------------

export interface RegisterEntityCrudEventsInput {
  entityType: string;
  /** Lowercased singular display name used in event descriptions. */
  singular: string;
}

export interface EntityCrudEventNames {
  created: string;
  updated: string;
  deleted: string;
}

/**
 * Register the three standard CRUD events for an entity and return the event
 * names so callers can emit them later. Event naming convention is
 * `{entityType}.Created` / `.Updated` / `.Deleted`.
 */
export function registerEntityCrudEvents(
  eventRegistry: EventRegistryService,
  input: RegisterEntityCrudEventsInput,
): EntityCrudEventNames {
  const { entityType, singular } = input;
  const created = `${entityType}.Created`;
  const updated = `${entityType}.Updated`;
  const deleted = `${entityType}.Deleted`;

  eventRegistry.register({
    eventName: created,
    group: entityType,
    description: `Fired when a new ${singular} is created`,
    payloadSchema: {},
  });
  eventRegistry.register({
    eventName: updated,
    group: entityType,
    description: `Fired when a ${singular} is updated`,
    payloadSchema: { changes: { type: 'string', label: 'Changed Fields' } },
  });
  eventRegistry.register({
    eventName: deleted,
    group: entityType,
    description: `Fired when a ${singular} is deleted`,
    payloadSchema: {},
  });

  return { created, updated, deleted };
}

// ---------------------------------------------------------------------------
// Workflow transition events
// ---------------------------------------------------------------------------

export interface RegisterWorkflowTransitionEventInput {
  entityType: string;
  fieldKey: string;
  /** Lowercased singular display name used in the description. */
  singular: string;
  /** The workflow field's display label (e.g. 'Stage', 'Status'). Lowercased in copy. */
  fieldLabel: string;
}

/**
 * Register a workflow transition event for one workflow field on an entity.
 * Event name is `{entityType}.{PascalFieldKey}Changed`. Returns the name so
 * callers can emit it.
 */
export function registerWorkflowTransitionEvent(
  eventRegistry: EventRegistryService,
  input: RegisterWorkflowTransitionEventInput,
): string {
  const { entityType, fieldKey, singular, fieldLabel } = input;
  const pascalField = fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1);
  const eventName = `${entityType}.${pascalField}Changed`;
  const lowerLabel = fieldLabel.toLowerCase();

  eventRegistry.register({
    eventName,
    group: entityType,
    description: `Fired when a ${singular}'s ${lowerLabel} changes`,
    payloadSchema: {
      fromState: { type: 'string', label: `Previous ${fieldLabel}` },
      toState: { type: 'string', label: `New ${fieldLabel}` },
      transitionName: { type: 'string', label: 'Transition' },
    },
  });

  return eventName;
}

// ---------------------------------------------------------------------------
// Audit hookup
// ---------------------------------------------------------------------------

export interface RegisterEntityAuditInput {
  entityType: string;
  /** Event names that should produce audit-log entries (typically created/updated/deleted plus workflow transitions). */
  eventNames: string[];
}

/**
 * Register an entity for audit logging on the given event names. No-op when
 * the audit extension is not loaded — the audit addon is opt-in.
 */
export function registerEntityAudit(
  auditExt: AuditExtension | null | undefined,
  input: RegisterEntityAuditInput,
): void {
  if (!auditExt) return;
  auditExt.register(input.entityType, { events: input.eventNames });
}

// ---------------------------------------------------------------------------
// Lookup resolver
// ---------------------------------------------------------------------------

export interface RegisterEntityLookupInput {
  entityType: string;
  table: PgTable;
  labelField: string;
  searchFields: string[];
  /** Defaults to 'id' — override only for entities whose lookup target column is not the primary key. */
  valueField?: string;
}

/**
 * Register an entity as a lookup target so other entities can resolve FK
 * labels and search the entity from a lookup-typed field. Hand-written
 * services call this directly; the engine calls it for entities that declare
 * `EntityConfig.lookup`.
 */
export function registerEntityLookup(
  lookupResolver: LookupResolverService,
  input: RegisterEntityLookupInput,
): void {
  lookupResolver.register({
    entity: input.entityType,
    table: input.table,
    labelField: input.labelField,
    valueField: input.valueField ?? 'id',
    searchFields: input.searchFields,
  });
}
