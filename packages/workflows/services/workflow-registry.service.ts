import { Injectable, NotFoundException, type OnModuleInit } from '@nestjs/common';
import { DatabaseService, eq, and, isNull } from '@packages/database';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import { workflowDefinitions } from '../schema/workflow-definitions';
import { workflowStates } from '../schema/workflow-states';
import { workflowTransitions } from '../schema/workflow-transitions';
import type { CachedWorkflowDefinition, CachedWorkflowState, CachedWorkflowTransition } from '../types';

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

    this.cache.clear();

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
        metadata: s.metadata as Record<string, unknown> | null,
      }));

      const cachedTransitions: CachedWorkflowTransition[] = defTransitions.map((t) => ({
        id: t.id,
        fromStateName: stateNameById.get(t.fromStateId) ?? '',
        toStateName: stateNameById.get(t.toStateId) ?? '',
        name: t.name,
        requiredPermissions: (t.requiredPermissions as string[] | null) ?? [],
        guardNames: (t.guardNames as string[] | null) ?? [],
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
      };

      this.cache.set(def.slug, cached);
    }
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
    metadata?: Record<string, unknown>;
  }) {
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
    guardNames?: string[];
    sortOrder?: number;
    reasonOptions?: string[];
    reasonRequired?: boolean;
    commentRequired?: boolean;
    metadata?: Record<string, unknown>;
  }) {
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
    guardNames: string[] | null;
    sortOrder: number;
    reasonOptions: string[] | null;
    reasonRequired: boolean;
    commentRequired: boolean;
    metadata: Record<string, unknown> | null;
  }>) {
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
