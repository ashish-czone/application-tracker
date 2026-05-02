import { BadRequestException, Injectable, NotFoundException, type OnModuleInit } from '@nestjs/common';
import { DatabaseService, eq, and, isNull } from '@packages/database';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import { workflowDefinitions } from '../schema/workflow-definitions';
import { workflowStates } from '../schema/workflow-states';
import { workflowTransitions } from '../schema/workflow-transitions';
import type { WorkflowDefinition } from '../define-workflow';
import type { CachedWorkflowDefinition, CachedWorkflowState, CachedWorkflowTransition } from '../types';

/**
 * Stable id prefix for code-defined workflow definitions, states, and
 * transitions. The DB has no row with these ids — `workflow_transition_history`
 * stores them as plain text after the FK to `workflow_definitions.id` was
 * dropped. Any id starting with this prefix means the entry was registered via
 * `defineWorkflow()` + `WorkflowsModule.forFeature(...)` and is read-only.
 */
const CODE_ID_PREFIX = 'code:';

export const isCodeDefinedWorkflowId = (id: string) => id.startsWith(CODE_ID_PREFIX);

const codeNotEditable = (kind: 'definition' | 'state' | 'transition') =>
  new BadRequestException(
    `Cannot mutate ${kind}: this workflow is code-defined (declared via defineWorkflow). Edit the source code, not via API.`,
  );

@Injectable()
export class WorkflowRegistryService implements OnModuleInit {
  private cache = new Map<string, CachedWorkflowDefinition>();

  constructor(private readonly database: DatabaseService) {}

  async onModuleInit() {
    await this.loadAll();
  }

  async loadAll() {
    const definitions = await this.database.db
      .select()
      .from(workflowDefinitions)
      .where(withTenant(workflowDefinitions, eq(workflowDefinitions.isActive, true), isNull(workflowDefinitions.deletedAt)));

    const allStates = await this.database.db
      .select()
      .from(workflowStates)
      .where(withTenant(workflowStates));

    const allTransitions = await this.database.db
      .select()
      .from(workflowTransitions)
      .where(withTenant(workflowTransitions));

    // Index states and transitions by definition ID
    const statesByDef = new Map<string, typeof allStates>();
    for (const state of allStates) {
      const list = statesByDef.get(state.workflowDefinitionId) ?? [];
      list.push(state);
      statesByDef.set(state.workflowDefinitionId, list);
    }

    const transitionsByDef = new Map<string, typeof allTransitions>();
    for (const transition of allTransitions) {
      const list = transitionsByDef.get(transition.workflowDefinitionId) ?? [];
      list.push(transition);
      transitionsByDef.set(transition.workflowDefinitionId, list);
    }

    // Drop only admin-persisted entries before reloading. Code-defined defs
    // (registered once at boot via WorkflowsModule.forFeature) live only in
    // memory — they survive truncates, reloads, and admin mutations.
    for (const [slug, cached] of this.cache) {
      if (cached.source === 'admin') this.cache.delete(slug);
    }

    for (const def of definitions) {
      const defStates = statesByDef.get(def.id) ?? [];
      const defTransitions = transitionsByDef.get(def.id) ?? [];

      // Build state name lookup for transitions
      const stateNameById = new Map<string, string>();
      for (const s of defStates) {
        stateNameById.set(s.id, s.name);
      }

      const cachedStates: CachedWorkflowState[] = defStates.map((s) => ({
        id: s.id,
        name: s.name,
        label: s.label,
        color: s.color,
        sortOrder: s.sortOrder,
        isSystem: s.isSystem,
        metadata: s.metadata as Record<string, unknown> | null,
      }));

      const cachedTransitions: CachedWorkflowTransition[] = defTransitions.map((t) => ({
        id: t.id,
        fromStateName: stateNameById.get(t.fromStateId) ?? '',
        toStateName: stateNameById.get(t.toStateId) ?? '',
        name: t.name,
        requiredPermissions: (t.requiredPermissions as string[] | null) ?? [],
        sortOrder: t.sortOrder,
        reasonOptions: t.reasonOptions ?? null,
        reasonRequired: t.reasonRequired,
        commentRequired: t.commentRequired,
        metadata: t.metadata as Record<string, unknown> | null,
      }));

      const cached: CachedWorkflowDefinition = {
        id: def.id,
        slug: def.slug,
        name: def.name,
        entityType: def.entityType,
        fieldName: def.fieldName,
        initialState: def.initialState,
        isActive: def.isActive,
        discriminatorKey: def.discriminatorKey,
        discriminatorValue: def.discriminatorValue,
        isDefault: def.isDefault,
        states: cachedStates,
        transitions: cachedTransitions,
        source: 'admin',
      };

      this.cache.set(def.slug, cached);
    }
  }

  /**
   * Register a code-defined workflow into the in-memory cache. The definition
   * is **not** persisted to `workflow_definitions`; it lives only in memory
   * across the process lifetime. Called from `WorkflowFeatureRegistrations`
   * on module init. Idempotent — re-calling with the same slug replaces the
   * existing entry.
   *
   * Ids are deterministic and `code:`-prefixed so callers (history, mutation
   * guards) can recognize code-defined entities by id alone.
   */
  registerInMemory(def: WorkflowDefinition): void {
    this.cache.set(def.slug, this.buildCodeDefinedCache(def));
  }

  private buildCodeDefinedCache(def: WorkflowDefinition): CachedWorkflowDefinition {
    const definitionId = `${CODE_ID_PREFIX}${def.slug}`;

    const cachedStates: CachedWorkflowState[] = def.states.map((s, i) => ({
      id: `${definitionId}:state:${s.name}`,
      name: s.name,
      label: s.label,
      color: s.color ?? null,
      sortOrder: i,
      isSystem: s.isSystem ?? false,
      metadata: null,
    }));

    const stateNames = new Set(def.states.map((s) => s.name));
    const cachedTransitions: CachedWorkflowTransition[] = [];
    let txIndex = 0;

    for (const transition of def.transitions) {
      if (!stateNames.has(transition.from)) continue;

      for (let i = 0; i < transition.to.length; i++) {
        const target = transition.to[i];
        const isString = typeof target === 'string';
        const targetName = isString ? target : target.state;
        const targetDef = isString ? undefined : target;

        if (!stateNames.has(targetName)) continue;

        const targetState = def.states.find((s) => s.name === targetName);
        const name = targetState?.label ?? targetName;

        cachedTransitions.push({
          id: `${definitionId}:transition:${txIndex++}`,
          fromStateName: transition.from,
          toStateName: targetName,
          name,
          requiredPermissions: targetDef?.requiredPermissions ?? [],
          sortOrder: i,
          reasonOptions: targetDef?.reasonOptions ?? null,
          reasonRequired: targetDef?.reasonRequired ?? false,
          commentRequired: targetDef?.commentRequired ?? false,
          metadata: null,
        });
      }
    }

    return {
      id: definitionId,
      slug: def.slug,
      name: def.name ?? def.slug,
      entityType: def.entityType,
      fieldName: def.fieldName,
      initialState: def.initialState,
      isActive: true,
      discriminatorKey: null,
      discriminatorValue: null,
      isDefault: true,
      states: cachedStates,
      transitions: cachedTransitions,
      source: 'code',
    };
  }

  getAll(): CachedWorkflowDefinition[] {
    return Array.from(this.cache.values());
  }

  getBySlug(slug: string): CachedWorkflowDefinition | undefined {
    return this.cache.get(slug);
  }

  getByEntityType(entityType: string): CachedWorkflowDefinition[] {
    const results: CachedWorkflowDefinition[] = [];
    for (const def of this.cache.values()) {
      if (def.entityType === entityType) {
        results.push(def);
      }
    }
    return results;
  }

  /** Returns the first (or default) workflow for an entity field. Backward compatible. */
  getByEntityField(entityType: string, fieldName: string): CachedWorkflowDefinition | undefined {
    return this.getDefaultForField(entityType, fieldName);
  }

  /** Returns ALL active workflows for an entity field (multi-pipeline). */
  getAllForField(entityType: string, fieldName: string): CachedWorkflowDefinition[] {
    const results: CachedWorkflowDefinition[] = [];
    for (const def of this.cache.values()) {
      if (def.entityType === entityType && def.fieldName === fieldName) {
        results.push(def);
      }
    }
    return results;
  }

  /** Returns the default workflow for an entity field. */
  getDefaultForField(entityType: string, fieldName: string): CachedWorkflowDefinition | undefined {
    for (const def of this.cache.values()) {
      if (def.entityType === entityType && def.fieldName === fieldName && def.isDefault) {
        return def;
      }
    }
    // Fallback: return first match if no default is explicitly set
    for (const def of this.cache.values()) {
      if (def.entityType === entityType && def.fieldName === fieldName) {
        return def;
      }
    }
    return undefined;
  }

  /** Returns the workflow matching a discriminator value, or the default. */
  getByDiscriminator(entityType: string, fieldName: string, discriminatorValue: string): CachedWorkflowDefinition | undefined {
    const all = this.getAllForField(entityType, fieldName);
    return all.find((d) => d.discriminatorValue === discriminatorValue)
      ?? all.find((d) => d.isDefault);
  }

  // --- CRUD Operations ---

  async createDefinition(data: {
    slug: string;
    name: string;
    entityType: string;
    fieldName: string;
    initialState: string;
    discriminatorKey?: string;
    discriminatorValue?: string;
    isDefault?: boolean;
  }) {
    const [row] = await this.database.db
      .insert(workflowDefinitions)
      .values(withTenantInsert(workflowDefinitions, data))
      .returning();
    await this.loadAll();
    return row;
  }

  async updateDefinition(id: string, data: Partial<{
    name: string;
    entityType: string;
    fieldName: string;
    initialState: string;
    isActive: boolean;
    discriminatorKey: string;
    discriminatorValue: string;
    isDefault: boolean;
  }>) {
    if (isCodeDefinedWorkflowId(id)) throw codeNotEditable('definition');

    const [row] = await this.database.db
      .update(workflowDefinitions)
      .set(data)
      .where(withTenant(workflowDefinitions, eq(workflowDefinitions.id, id)))
      .returning();

    if (!row) throw new NotFoundException('Workflow definition not found');
    await this.loadAll();
    return row;
  }

  async deleteDefinition(id: string): Promise<void> {
    if (isCodeDefinedWorkflowId(id)) throw codeNotEditable('definition');

    const [row] = await this.database.db
      .update(workflowDefinitions)
      .set({ deletedAt: new Date() })
      .where(withTenant(workflowDefinitions, eq(workflowDefinitions.id, id)))
      .returning();

    if (!row) throw new NotFoundException('Workflow definition not found');
    await this.loadAll();
  }

  async createState(definitionId: string, data: {
    name: string;
    label: string;
    color?: string;
    sortOrder?: number;
    isSystem?: boolean;
    metadata?: Record<string, unknown>;
  }) {
    if (isCodeDefinedWorkflowId(definitionId)) throw codeNotEditable('state');

    const [row] = await this.database.db
      .insert(workflowStates)
      .values(withTenantInsert(workflowStates, { workflowDefinitionId: definitionId, ...data }))
      .returning();
    await this.loadAll();
    return row;
  }

  async updateState(id: string, data: Partial<{
    name: string;
    label: string;
    color: string | null;
    sortOrder: number;
    metadata: Record<string, unknown> | null;
  }>) {
    if (isCodeDefinedWorkflowId(id)) throw codeNotEditable('state');

    const [row] = await this.database.db
      .update(workflowStates)
      .set(data)
      .where(withTenant(workflowStates, eq(workflowStates.id, id)))
      .returning();

    if (!row) throw new NotFoundException('Workflow state not found');
    await this.loadAll();
    return row;
  }

  async deleteState(id: string): Promise<void> {
    if (isCodeDefinedWorkflowId(id)) throw codeNotEditable('state');

    const [row] = await this.database.db
      .delete(workflowStates)
      .where(withTenant(workflowStates, eq(workflowStates.id, id)))
      .returning();

    if (!row) throw new NotFoundException('Workflow state not found');
    await this.loadAll();
  }

  async createTransition(definitionId: string, data: {
    fromStateId: string;
    toStateId: string;
    name: string;
    requiredPermissions?: string[];
    sortOrder?: number;
    reasonOptions?: string[];
    reasonRequired?: boolean;
    commentRequired?: boolean;
    metadata?: Record<string, unknown>;
  }) {
    if (isCodeDefinedWorkflowId(definitionId)) throw codeNotEditable('transition');

    const [row] = await this.database.db
      .insert(workflowTransitions)
      .values(withTenantInsert(workflowTransitions, { workflowDefinitionId: definitionId, ...data }))
      .returning();
    await this.loadAll();
    return row;
  }

  async updateTransition(id: string, data: Partial<{
    name: string;
    requiredPermissions: string[] | null;
    sortOrder: number;
    reasonOptions: string[] | null;
    reasonRequired: boolean;
    commentRequired: boolean;
    metadata: Record<string, unknown> | null;
  }>) {
    if (isCodeDefinedWorkflowId(id)) throw codeNotEditable('transition');

    const [row] = await this.database.db
      .update(workflowTransitions)
      .set(data)
      .where(withTenant(workflowTransitions, eq(workflowTransitions.id, id)))
      .returning();

    if (!row) throw new NotFoundException('Workflow transition not found');
    await this.loadAll();
    return row;
  }

  async deleteTransition(id: string): Promise<void> {
    if (isCodeDefinedWorkflowId(id)) throw codeNotEditable('transition');

    const [row] = await this.database.db
      .delete(workflowTransitions)
      .where(withTenant(workflowTransitions, eq(workflowTransitions.id, id)))
      .returning();

    if (!row) throw new NotFoundException('Workflow transition not found');
    await this.loadAll();
  }

  async invalidateCache(): Promise<void> {
    await this.loadAll();
  }
}
