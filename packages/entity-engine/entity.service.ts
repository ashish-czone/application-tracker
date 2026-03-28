import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { eq, and, or, isNull, ilike, asc, desc, count, sql, getTableName } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import {
  buildFilterConditions,
  buildSearchCondition,
  buildSoftDeleteCondition,
  buildSortExpression as qbBuildSortExpression,
  computePagination,
  computePaginationMeta,
  parseLegacyFilters,
  parseFilterParam,
  mergeFilters,
  OPERATORS_BY_FIELD_TYPE,
} from '@packages/query-builder';
import { DatabaseService } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import {
  FieldValueService,
  FieldDefinitionService,
  LookupResolverService,
  MultiValueService,
  RELATIONAL_FIELD_TYPES,
  buildSnapshot,
  diffSnapshot,
  validatePayload,
  splitPayload,
} from '@packages/eav-attributes';
import type { FieldDefinition } from '@packages/eav-attributes';
import { TaxonomyService, type TagWithGroup } from '@packages/taxonomy';
import { MediaService, type MediaFile } from '@packages/media';
import { WorkflowEngineService, WorkflowRegistryService } from '@packages/workflows';
import type { PaginatedResponse } from '@packages/common';
import type { EntityConfig, BaseListQuery, ListLayoutColumn } from './types';
import { EntityRegistryService } from './entity-registry.service';

/**
 * Generic CRUD service that works for ANY entity using its EntityConfig.
 *
 * Handles:
 * - List with pagination, search, sort, filters (standard + EAV)
 * - Single entity retrieval with EAV hydration
 * - Create with validation, split, uniqueness checks, EAV writes
 * - Update with snapshot diffing, EAV writes, event emission
 * - Soft delete + restore
 *
 * Domain-specific logic is injected via hooks on EntityConfig.
 */
@Injectable()
export class EntityService {
  private readonly logger: ContextLogger;

  constructor(
    private readonly config: EntityConfig,
    private readonly database: DatabaseService,
    private readonly domainEventEmitter: DomainEventEmitter,
    private readonly fieldValueService: FieldValueService,
    private readonly fieldDefinitionService: FieldDefinitionService,
    private readonly lookupResolver: LookupResolverService,
    private readonly taxonomyService: TaxonomyService,
    private readonly multiValueService: MultiValueService,
    private readonly mediaService: MediaService,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly workflowRegistry: WorkflowRegistryService,
    private readonly entityRegistry: EntityRegistryService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(`EntityService[${config.entityType}]`);
  }

  /** The entity config this service was instantiated with. */
  getConfig(): EntityConfig {
    return this.config;
  }

  // ---------------------------------------------------------------------------
  // LIST LAYOUT
  // ---------------------------------------------------------------------------

  /** Field types excluded from list view — long text and non-tabular types. */
  private static readonly LIST_SKIP_TYPES = new Set(['textarea', 'rich_text', 'file', 'auto_number']);

  /** System columns always included in list queries. */
  private static readonly LIST_SYSTEM_COLUMNS = ['id', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy'];

  /**
   * Get all field definitions eligible for list queries.
   * Returns all non-system fields except long-text/file types.
   * listFields only controls default visibility, not data availability.
   */
  private async getListFieldDefs(): Promise<FieldDefinition[]> {
    const defs = await this.fieldDefinitionService.listByEntityWithOptions(this.config.entityType);
    return defs.filter(d => !EntityService.LIST_SKIP_TYPES.has(d.fieldType) && !d.isSystem);
  }

  /**
   * Build a Drizzle select map for list queries — only standard DB columns
   * that appear in the list layout + required system columns.
   */
  private buildListSelectMap(listDefs: FieldDefinition[]): Record<string, PgColumn> {
    const table = this.config.table as any;
    const selectMap: Record<string, PgColumn> = {};

    for (const key of EntityService.LIST_SYSTEM_COLUMNS) {
      if (table[key]) {
        selectMap[key] = table[key];
      }
    }

    // Always include nameField and subtitleField (needed for display even if system/hidden)
    const { nameField, subtitleField } = this.config.ui;
    const displayFields = Array.isArray(nameField) ? [...nameField] : [nameField];
    if (subtitleField) displayFields.push(subtitleField);
    for (const key of displayFields) {
      if (table[key]) selectMap[key] = table[key];
    }

    for (const def of listDefs) {
      if (def.columnName !== null && table[def.fieldKey]) {
        selectMap[def.fieldKey] = table[def.fieldKey];
      }
    }

    return selectMap;
  }

  /**
   * Build COUNT subquery expressions for hasMany relationships.
   * Auto-derives from the entity's relationships config.
   */
  private buildRelationshipCountExpressions(): Record<string, any> {
    const { config } = this;
    const counts: Record<string, any> = {};
    const thisTableName = getTableName(config.table);

    for (const rel of config.relationships ?? []) {
      if (rel.type !== 'hasMany' || !rel.foreignKey) continue;

      // Convert camelCase foreignKey to snake_case DB column name
      const fkColumn = rel.foreignKey.replace(/[A-Z]/g, (c: string) => `_${c.toLowerCase()}`);
      const targetTableName = rel.targetEntity;
      const key = `${rel.name}Count`;

      counts[key] = sql.raw(
        `(SELECT COUNT(*) FROM "${targetTableName}" WHERE "${fkColumn}" = "${thisTableName}"."id" AND "deleted_at" IS NULL)`,
      );
    }

    return counts;
  }

  /**
   * Returns list page layout config: columns, actions, filters, sort defaults.
   * Includes all fields with visible/order flags based on listFields config.
   * Cached by the frontend — this is config, not data.
   */
  async getListLayout(): Promise<import('./types').ListLayoutResponse> {
    const { config } = this;
    const allDefs = await this.fieldDefinitionService.listByEntityWithOptions(config.entityType);

    // Build the listFields set for determining default visibility
    const listFieldSet = config.listFields ? new Set(config.listFields) : null;
    const listFieldOrder = config.listFields
      ? new Map(config.listFields.map((k, i) => [k, i]))
      : null;

    // All entity fields as columns with visible/order flags (exclude long-text/file types)
    const columns: ListLayoutColumn[] = allDefs
      .filter(d => !d.isSystem && !EntityService.LIST_SKIP_TYPES.has(d.fieldType))
      .map((d, idx) => ({
        fieldKey: d.fieldKey,
        label: d.label,
        fieldType: d.fieldType,
        sortable: !!config.sortableColumns[d.fieldKey],
        lookupEntity: d.lookupEntity ?? undefined,
        visible: listFieldSet ? listFieldSet.has(d.fieldKey) : !EntityService.LIST_SKIP_TYPES.has(d.fieldType) && idx < 10,
        order: listFieldOrder?.get(d.fieldKey) ?? 1000 + idx,
        picklistOptions: (d.fieldType === 'picklist' || d.fieldType === 'multi_select') && d.picklistOptions?.length
          ? d.picklistOptions.map(o => ({ label: o.label, value: o.value }))
          : undefined,
        operators: OPERATORS_BY_FIELD_TYPE[d.fieldType],
      }));

    // Append hasMany relationship count columns
    for (const rel of config.relationships ?? []) {
      if (rel.type !== 'hasMany' || !rel.foreignKey) continue;
      const key = `${rel.name}Count`;
      columns.push({
        fieldKey: key,
        label: `${rel.label} Count`,
        fieldType: 'number',
        sortable: false,
        lookupEntity: undefined,
        visible: listFieldSet ? listFieldSet.has(key) : false,
        order: listFieldOrder?.get(key) ?? 2000,
        relationship: {
          targetEntity: rel.targetEntity,
          foreignKey: rel.foreignKey,
        },
      });
    }

    // Sort by order
    columns.sort((a, b) => a.order - b.order);

    // Build filterable fields (picklists, lookups, booleans, tags)
    const defs = await this.fieldDefinitionService.listByEntityWithOptions(config.entityType);
    const filterableTypes = new Set(['picklist', 'multi_select', 'lookup', 'user', 'boolean', 'tags', 'category']);
    const filters = defs
      .filter(d => filterableTypes.has(d.fieldType))
      .map(d => d.fieldKey);

    // Default actions if none configured
    const defaultActions: import('./types').EntityActions = {
      row: [
        { key: 'edit', label: 'Edit', icon: 'Pencil', permission: 'update' },
        { key: 'clone', label: 'Clone', icon: 'Copy', permission: 'create' },
        { key: 'delete', label: 'Delete', icon: 'Trash2', permission: 'delete', variant: 'destructive' },
      ],
      bulk: [
        { key: 'massUpdate', label: 'Mass Update', icon: 'PenLine', permission: 'update' },
        { key: 'massDelete', label: 'Mass Delete', icon: 'Trash2', permission: 'delete', variant: 'destructive' },
        { key: 'export', label: 'Export', icon: 'Download', permission: 'read' },
      ],
      detail: [
        { key: 'clone', label: 'Clone', icon: 'Copy', permission: 'create' },
        { key: 'delete', label: 'Delete', icon: 'Trash2', permission: 'delete', variant: 'destructive' },
      ],
    };

    return {
      columns,
      actions: config.actions ?? defaultActions,
      filters,
      defaultSort: config.defaultSort,
      defaultOrder: 'desc',
    };
  }

  // ---------------------------------------------------------------------------
  // LIST
  // ---------------------------------------------------------------------------

  async list(query: BaseListQuery): Promise<PaginatedResponse<Record<string, unknown>>> {
    const { page, limit, offset } = computePagination({
      page: query.page ?? 1,
      limit: query.limit ?? 25,
    });
    const { config } = this;

    const conditions: any[] = [];

    // Soft delete filter (delegated to query-builder)
    const softDeleteCond = buildSoftDeleteCondition(
      (config.table as any).deletedAt,
      query.includeDeleted ?? false,
    );
    if (softDeleteCond) conditions.push(softDeleteCond);

    // Search across configured columns + lookup field labels
    if (query.search) {
      const searchConditions: any[] = [];

      // Standard column search (delegated to query-builder)
      const stdSearch = buildSearchCondition(query.search, config.searchColumns);
      if (stdSearch) searchConditions.push(stdSearch);

      // Lookup field search — entity-specific, stays here
      const lookupSearchConds = this.buildLookupSearchConditions(query.search);
      searchConditions.push(...lookupSearchConds);

      if (searchConditions.length > 0) {
        conditions.push(or(...searchConditions));
      }
    }

    // Generic field-level filters (delegated to query-builder + EAV routing)
    const filterConditions = await this.buildAllFilters(query, config);
    conditions.push(...filterConditions);

    // Custom filters from hooks (for anything not covered by generic filtering)
    if (config.hooks?.buildListFilters) {
      const extraFilters = config.hooks.buildListFilters(query);
      conditions.push(...extraFilters);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Sort — check if the sort key is a lookup field, use label subquery if so
    const sortKey = query.sort ?? config.defaultSort;
    const orderDirection = query.order === 'asc' ? 'ASC' : 'DESC';
    const orderByExpr = this.buildSortExpression(sortKey, orderDirection, config);

    // Count
    const [{ total }] = await this.database.db
      .select({ total: count() })
      .from(config.table as any)
      .where(whereClause) as any[];

    // Fetch only list-relevant columns instead of SELECT *
    const listDefs = await this.getListFieldDefs();
    const selectMap: Record<string, any> = this.buildListSelectMap(listDefs);

    // Add hasMany relationship count subqueries
    const countExprs = this.buildRelationshipCountExpressions();
    Object.assign(selectMap, countExprs);

    const rows = await this.database.db
      .select(selectMap)
      .from(config.table as any)
      .where(whereClause)
      .orderBy(orderByExpr)
      .limit(limit)
      .offset(offset);

    // Batch-hydrate EAV values
    const entityIds = rows.map((r: any) => r.id);
    const eavMap = entityIds.length > 0
      ? await this.fieldValueService.getBatchValues(config.entityType, entityIds)
      : new Map<string, Record<string, unknown>>();

    const data = await Promise.all(
      rows.map((row: any) => this.toResponse(row, eavMap.get(row.id))),
    );

    // Resolve lookup field labels (candidateId → candidateId__label: "Jane Smith")
    await this.resolveLookupLabels(data);

    // Hydrate relational fields (tags → tag objects with name/color)
    await this.hydrateRelationalFields(data);

    return {
      data,
      meta: computePaginationMeta(Number(total), page, limit),
    };
  }

  // ---------------------------------------------------------------------------
  // FIND ONE
  // ---------------------------------------------------------------------------

  async findOneOrFail(id: string): Promise<Record<string, unknown>> {
    const { config } = this;
    const table = config.table as any;

    const conditions: any[] = [eq(table.id, id)];

    if (table.deletedAt) {
      conditions.push(isNull(table.deletedAt));
    }

    const [row] = await this.database.db
      .select()
      .from(table)
      .where(and(...conditions))
      .limit(1) as any[];

    if (!row) {
      throw new NotFoundException(`${config.singularName} not found`);
    }

    // Compute relationship counts for detail view
    const countExprs = this.buildRelationshipCountExpressions();
    if (Object.keys(countExprs).length > 0) {
      const [countRow] = await this.database.db
        .select(countExprs)
        .from(table)
        .where(eq(table.id, id))
        .limit(1) as any[];
      if (countRow) Object.assign(row, countRow);
    }

    const response = await this.toResponse(row);
    await this.resolveLookupLabels([response]);
    await this.hydrateRelationalFields([response]);
    return response;
  }

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------

  async create(payload: Record<string, unknown>, actorId: string): Promise<Record<string, unknown>> {
    const { config } = this;
    let data = { ...payload };

    // Hook: beforeCreate
    if (config.hooks?.beforeCreate) {
      data = await config.hooks.beforeCreate(data, actorId);
    }

    // Load field definitions
    const defs = await this.fieldDefinitionService.listByEntityWithOptions(config.entityType);

    // Validate
    const result = validatePayload(defs, data, { partial: false });
    if (!result.valid) {
      throw new BadRequestException({ message: 'Validation failed', errors: result.errors });
    }

    // Split standard vs custom vs relational
    const { standardFields, customFields, relationalFields } = splitPayload(defs, data);

    // Email normalization (if email field exists)
    if (standardFields.email && typeof standardFields.email === 'string') {
      standardFields.email = standardFields.email.toLowerCase();
    }

    // Check uniqueness for standard unique columns
    await this.checkStandardUniqueness(defs, standardFields);

    // Check uniqueness for custom EAV unique fields
    await this.checkEavUniqueness(defs, customFields);

    // Insert in transaction
    const row = await this.database.db.transaction(async (tx) => {
      const result = await tx
        .insert(config.table as any)
        .values({ ...standardFields, createdBy: actorId } as any)
        .returning() as any[];
      const inserted = result[0];

      if (Object.keys(customFields).length > 0) {
        await this.fieldValueService.setValues(config.entityType, inserted.id, customFields, tx);
      }

      return inserted;
    });

    // Handle relational fields (tags, category, multi) after entity exists
    if (Object.keys(relationalFields).length > 0) {
      await this.handleRelationalCreate(row.id, relationalFields, defs);
    }

    // Move tmp files to permanent storage and update EAV values
    if (Object.keys(customFields).length > 0) {
      await this.processFileFields(customFields, row.id, defs);
    }

    this.logger.log(`${config.singularName} created`, { entityId: row.id, actorId });

    // Hook: afterCreate
    if (config.hooks?.afterCreate) {
      await config.hooks.afterCreate(row, actorId);
    }

    // Emit event (with resolved lookup labels for audit readability)
    const snapshot = await this.buildEntitySnapshot(row);
    await this.resolveLookupLabels([snapshot]);
    this.domainEventEmitter.emitDynamic(`${config.entityType}.Created`, {
      entityType: config.entityType,
      entityId: row.id,
      actorId,
      payload: { after: snapshot },
    });

    return this.toResponse(row);
  }

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------

  async update(id: string, payload: Record<string, unknown>, actorId: string): Promise<Record<string, unknown>> {
    const { config } = this;
    const table = config.table as any;

    // Ensure entity exists
    await this.findOneOrFail(id);

    let data = { ...payload };

    // Hook: beforeUpdate
    if (config.hooks?.beforeUpdate) {
      data = await config.hooks.beforeUpdate(id, data, actorId);
    }

    // Load field definitions
    const defs = await this.fieldDefinitionService.listByEntityWithOptions(config.entityType);

    // Reject workflow field changes in generic update
    const workflowFieldKeys = defs.filter(d => d.fieldType === 'workflow').map(d => d.fieldKey);
    for (const wfField of workflowFieldKeys) {
      if (wfField in data) {
        throw new BadRequestException(
          `Field '${wfField}' is a workflow field. Use POST /${config.slug}/${id}/transition instead.`,
        );
      }
    }

    // Validate (partial mode)
    const result = validatePayload(defs, data, { partial: true });
    if (!result.valid) {
      throw new BadRequestException({ message: 'Validation failed', errors: result.errors });
    }

    // Split
    const { standardFields, customFields, relationalFields } = splitPayload(defs, data);

    // Filter out undefined values
    const updateValues: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(standardFields)) {
      if (value !== undefined) {
        updateValues[key] = key === 'email' && typeof value === 'string' ? value.toLowerCase() : value;
      }
    }

    const hasStandardChanges = Object.keys(updateValues).length > 0;
    const hasCustomChanges = Object.keys(customFields).length > 0;
    const hasRelationalChanges = Object.keys(relationalFields).length > 0;

    if (!hasStandardChanges && !hasCustomChanges && !hasRelationalChanges) {
      return this.findOneOrFail(id);
    }

    // Check uniqueness
    await this.checkStandardUniqueness(defs, updateValues, id);
    await this.checkEavUniqueness(defs, customFields, id);

    let eventPayload: { changes: string[]; before: Record<string, unknown>; after: Record<string, unknown> } | null = null;

    const updated = await this.database.db.transaction(async (tx) => {
      // Read before snapshot inside tx for consistency
      const eavBefore = await this.fieldValueService.getValues(config.entityType, id, tx);
      const [existingRow] = await tx.select().from(table).where(eq(table.id, id)).limit(1) as any[];
      const before = buildSnapshot(this.rowToSnapshot(existingRow), eavBefore);

      // Update standard columns
      let row = existingRow;
      if (hasStandardChanges) {
        const [updatedRow] = await tx
          .update(table)
          .set(updateValues)
          .where(eq(table.id, id))
          .returning() as any[];
        row = updatedRow;
      }

      // Update EAV values
      let eavAfter = eavBefore;
      if (hasCustomChanges) {
        const eavResult = await this.fieldValueService.setValues(config.entityType, id, customFields, tx);
        eavAfter = eavResult.after;
      }

      const after = buildSnapshot(this.rowToSnapshot(row), eavAfter);
      const changes = diffSnapshot(before, after);

      if (changes.length > 0) {
        eventPayload = { changes, before, after };
      }

      return row;
    });

    // Handle relational fields (tags, category, multi) after transaction
    if (hasRelationalChanges) {
      await this.handleRelationalUpdate(id, relationalFields, defs);
    }

    // Move tmp files to permanent storage and update EAV values
    if (hasCustomChanges) {
      await this.processFileFields(customFields, id, defs);
    }

    this.logger.log(`${config.singularName} updated`, { entityId: id, actorId });

    // Hook: afterUpdate
    if (config.hooks?.afterUpdate) {
      await config.hooks.afterUpdate(updated, actorId);
    }

    // Emit event after transaction (with resolved lookup labels for audit readability)
    if (eventPayload) {
      await this.resolveLookupLabels([eventPayload.before, eventPayload.after]);
      this.domainEventEmitter.emitDynamic(`${config.entityType}.Updated`, {
        entityType: config.entityType,
        entityId: id,
        actorId,
        payload: eventPayload,
      });
    }

    return this.toResponse(updated);
  }

  // ---------------------------------------------------------------------------
  // WORKFLOW TRANSITION
  // ---------------------------------------------------------------------------

  async transition(
    id: string,
    fieldKey: string,
    toState: string,
    actorId: string,
    comment?: string,
  ): Promise<Record<string, unknown>> {
    const { config } = this;
    const table = config.table as any;

    // 1. Get current entity
    const entity = await this.findOneOrFail(id);

    // 2. Look up workflow for this field
    const workflow = this.workflowRegistry.getByEntityField(config.entityType, fieldKey);
    if (!workflow) {
      throw new BadRequestException(`No workflow found for field '${fieldKey}' on '${config.entityType}'`);
    }

    const currentState = entity[fieldKey] as string | null;
    if (!currentState) {
      throw new BadRequestException(`Entity has no current state for field '${fieldKey}'`);
    }

    // 3. Validate transition (permissions, guards, conditions) — throws on failure
    const validated = await this.workflowEngine.validateAndThrow({
      workflowSlug: workflow.slug,
      entityType: config.entityType,
      entityId: id,
      fromState: currentState,
      toState,
      actorId,
      entityData: entity as Record<string, unknown>,
    });

    // 4. Update entity field + record history in a single transaction
    const col = table[fieldKey];
    await this.database.db.transaction(async (tx) => {
      if (col) {
        await tx
          .update(table)
          .set({ [fieldKey]: toState })
          .where(eq(table.id, id));
      } else {
        await this.fieldValueService.setValues(config.entityType, id, { [fieldKey]: toState }, tx);
      }

      await this.workflowEngine.recordHistory({
        workflowDefinitionId: validated.workflowDefinitionId,
        entityType: config.entityType,
        entityId: id,
        fieldName: validated.fieldName,
        fromState: currentState,
        toState,
        transitionId: validated.transitionId,
        actorId,
        comment,
      }, tx);
    });

    this.logger.log(`${config.singularName} transitioned`, {
      entityId: id, fieldKey, from: currentState, to: toState, actorId,
    });

    // 5. Emit entity-specific event after transaction commits
    // e.g. "applications.StageChanged", "tasks.StatusChanged"
    const pascalField = fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1);
    this.domainEventEmitter.emitDynamic(`${config.entityType}.${pascalField}Changed`, {
      entityType: config.entityType,
      entityId: id,
      actorId,
      payload: {
        workflowSlug: workflow.slug,
        fieldName: validated.fieldName,
        fromState: currentState,
        toState,
        transitionId: validated.transitionId,
        transitionName: validated.transitionName,
        comment,
      },
    });

    return this.findOneOrFail(id);
  }

  // ---------------------------------------------------------------------------
  // SOFT DELETE
  // ---------------------------------------------------------------------------

  async softDelete(id: string, actorId: string): Promise<void> {
    const { config } = this;
    const entity = await this.findOneOrFail(id);

    // Hook: beforeDelete
    if (config.hooks?.beforeDelete) {
      await config.hooks.beforeDelete(id, actorId);
    }

    await this.database.db
      .update(config.table as any)
      .set({ deletedAt: new Date(), deletedBy: actorId } as any)
      .where(eq((config.table as any).id, id));

    this.logger.log(`${config.singularName} deleted`, { entityId: id, actorId });

    await this.resolveLookupLabels([entity]);
    this.domainEventEmitter.emitDynamic(`${config.entityType}.Deleted`, {
      entityType: config.entityType,
      entityId: id,
      actorId,
      payload: { before: entity },
    });
  }

  // ---------------------------------------------------------------------------
  // RESTORE
  // ---------------------------------------------------------------------------

  async restore(id: string): Promise<Record<string, unknown>> {
    const { config } = this;
    const table = config.table as any;

    const [row] = await this.database.db
      .select()
      .from(table)
      .where(eq(table.id, id))
      .limit(1) as any[];

    if (!row) {
      throw new NotFoundException(`${config.singularName} not found`);
    }

    const [restored] = await this.database.db
      .update(table)
      .set({ deletedAt: null, deletedBy: null } as any)
      .where(eq(table.id, id))
      .returning() as any[];

    this.logger.log(`${config.singularName} restored`, { entityId: id });

    return this.toResponse(restored);
  }

  // ---------------------------------------------------------------------------
  // HELPERS (private)
  // ---------------------------------------------------------------------------

  /**
   * Build lookup field search conditions (EXISTS subqueries).
   * Entity-specific — searches related entity labels via foreign keys.
   */
  private buildLookupSearchConditions(search: string): any[] {
    const { config } = this;
    const pattern = `%${search}%`;
    const conditions: any[] = [];

    for (const [fieldKey, meta] of Object.entries(config.fieldMeta)) {
      if (!meta.lookupEntity) continue;
      const lookupConfig = this.lookupResolver.getConfig(meta.lookupEntity);
      if (!lookupConfig) continue;

      const targetTable = lookupConfig.table;
      const valueCol = targetTable[lookupConfig.valueField];
      const fkCol = (config.table as any)[fieldKey];
      if (!valueCol || !fkCol) continue;

      const searchFields = lookupConfig.searchFields?.length > 0
        ? lookupConfig.searchFields
        : [lookupConfig.labelField];

      const fieldConditions = searchFields
        .map((f: string) => targetTable[f])
        .filter(Boolean)
        .map((col: any) => sql`${col} ILIKE ${pattern}`);

      if (fieldConditions.length > 0) {
        const orClause = fieldConditions.length === 1
          ? fieldConditions[0]
          : sql.join(fieldConditions, sql` OR `);
        conditions.push(
          sql`EXISTS (SELECT 1 FROM ${targetTable} WHERE ${valueCol} = ${fkCol} AND (${orClause}))`,
        );
      }
    }

    return conditions;
  }

  /**
   * Build the ORDER BY expression for list queries.
   * For lookup fields, uses a subquery to sort by the related entity's label.
   * For standard columns, delegates to query-builder.
   */
  private buildSortExpression(sortKey: string, direction: 'ASC' | 'DESC', config: EntityConfig): any {
    // Check if the sort key is a lookup field (entity-specific logic)
    const meta = config.fieldMeta[sortKey];
    if (meta?.lookupEntity) {
      const lookupConfig = this.lookupResolver.getConfig(meta.lookupEntity);
      if (lookupConfig) {
        const targetTable = lookupConfig.table;
        const labelCol = targetTable[lookupConfig.labelField];
        const valueCol = targetTable[lookupConfig.valueField];
        const fkCol = (config.table as any)[sortKey];

        if (labelCol && valueCol && fkCol) {
          return sql`(SELECT ${labelCol} FROM ${targetTable} WHERE ${valueCol} = ${fkCol}) ${sql.raw(direction)}`;
        }
      }
    }

    // Standard column sort (delegated to query-builder)
    return qbBuildSortExpression(
      sortKey,
      direction === 'ASC' ? 'asc' : 'desc',
      config.sortableColumns,
      config.defaultSort,
    );
  }

  /**
   * Build all filter conditions from legacy query params.
   * Resolves standard DB columns via query-builder, routes EAV fields to FieldValueService.
   */
  private async buildAllFilters(
    query: BaseListQuery,
    config: EntityConfig,
  ): Promise<any[]> {
    // Convert legacy ?field=value params to FilterExpressions
    const legacyFilters = parseLegacyFilters(query);

    // Parse structured ?filters=[...] param (if present)
    const structuredFilters = query.filters
      ? parseFilterParam(query.filters as string)
      : [];

    // Merge: structured takes precedence for same field
    const allFilters = mergeFilters(legacyFilters, structuredFilters);
    if (allFilters.length === 0) return [];

    // Load field definitions to build column map and identify EAV fields
    const defs = await this.fieldDefinitionService.listByEntityWithOptions(config.entityType);
    const table = config.table as any;

    // Build column map for standard DB columns
    const columnMap: Record<string, any> = {};
    for (const def of defs) {
      if (def.columnName && table[def.fieldKey]) {
        columnMap[def.fieldKey] = table[def.fieldKey];
      }
    }

    // Resolve standard column filters via query-builder
    const { conditions, unresolved } = buildFilterConditions(allFilters, columnMap);

    // Route unresolved filters to EAV (only for known EAV fields)
    const defsByKey = new Map(defs.map((d) => [d.fieldKey, d]));
    const eavFilters = unresolved
      .filter((f) => defsByKey.has(f.field) && !defsByKey.get(f.field)!.columnName)
      .map((f) => ({ fieldKey: f.field, operator: f.operator as any, value: f.value }));

    if (eavFilters.length > 0) {
      const eavCondition = this.fieldValueService.buildFilterCondition(
        config.entityType,
        table.id,
        eavFilters,
      );
      conditions.push(eavCondition);
    }

    return conditions;
  }

  // ---------------------------------------------------------------------------
  // RELATIONAL FIELD HELPERS (tags, category, multi)
  // ---------------------------------------------------------------------------

  /**
   * After creating an entity, handle relational fields:
   * - tags: attach each tag ID via TaxonomyService
   * - category: stored as standard/EAV field (handled by splitPayload)
   */
  private async handleRelationalCreate(
    entityId: string,
    relationalFields: Record<string, unknown>,
    defs: FieldDefinition[],
  ): Promise<void> {
    const defMap = new Map(defs.map(d => [d.fieldKey, d]));

    for (const [key, value] of Object.entries(relationalFields)) {
      const def = defMap.get(key);
      if (!def) continue;

      if (def.fieldType === 'tags' && Array.isArray(value)) {
        for (const tagId of value) {
          if (typeof tagId === 'string') {
            try {
              await this.taxonomyService.attachTag(this.config.entityType, entityId, tagId);
            } catch {
              this.logger.warn(`Failed to attach tag ${tagId} to ${entityId}`);
            }
          }
        }
      }

      // multi_user / multi_lookup: store target IDs in junction table
      if ((def.fieldType === 'multi_user' || def.fieldType === 'multi_lookup') && Array.isArray(value)) {
        const targetIds = value.filter((v): v is string => typeof v === 'string');
        await this.multiValueService.setValues(this.config.entityType, entityId, key, targetIds);
      }
      // category: stored as a lookup-like text value — handled in standard/EAV flow
    }
  }

  /**
   * After updating an entity, sync relational fields:
   * - tags: diff current vs new, attach/detach accordingly
   */
  private async handleRelationalUpdate(
    entityId: string,
    relationalFields: Record<string, unknown>,
    defs: FieldDefinition[],
  ): Promise<void> {
    const defMap = new Map(defs.map(d => [d.fieldKey, d]));

    for (const [key, value] of Object.entries(relationalFields)) {
      const def = defMap.get(key);
      if (!def) continue;

      if (def.fieldType === 'tags' && Array.isArray(value)) {
        // Get current tags for this entity filtered by tag group
        const currentTags = await this.taxonomyService.getTagsForEntity(this.config.entityType, entityId);
        const groupTags = def.tagGroupSlug
          ? currentTags.filter(t => t.groupSlug === def.tagGroupSlug)
          : currentTags;
        const currentIds = new Set(groupTags.map(t => t.id));
        const newIds = new Set(value.filter((v): v is string => typeof v === 'string'));

        // Detach removed tags
        for (const id of currentIds) {
          if (!newIds.has(id)) {
            await this.taxonomyService.detachTag(this.config.entityType, entityId, id);
          }
        }
        // Attach new tags
        for (const id of newIds) {
          if (!currentIds.has(id)) {
            try {
              await this.taxonomyService.attachTag(this.config.entityType, entityId, id);
            } catch {
              this.logger.warn(`Failed to attach tag ${id} to ${entityId}`);
            }
          }
        }
      }

      // multi_user / multi_lookup: replace all target IDs
      if ((def.fieldType === 'multi_user' || def.fieldType === 'multi_lookup') && Array.isArray(value)) {
        const targetIds = value.filter((v): v is string => typeof v === 'string');
        await this.multiValueService.setValues(this.config.entityType, entityId, key, targetIds);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // FILE FIELD HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Check if a value looks like a MediaFile object.
   */
  private isMediaFile(value: unknown): value is MediaFile {
    return (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as any).key === 'string' &&
      typeof (value as any).originalName === 'string'
    );
  }

  /**
   * After entity create/update, move any tmp files to permanent storage
   * and update the EAV values with the new keys.
   */
  private async processFileFields(
    customFields: Record<string, unknown>,
    entityId: string,
    defs: FieldDefinition[],
  ): Promise<void> {
    const defMap = new Map(defs.map(d => [d.fieldKey, d]));
    const updates: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(customFields)) {
      const def = defMap.get(key);
      if (!def || def.fieldType !== 'file') continue;

      if (this.isMediaFile(value) && value.key.startsWith('tmp/')) {
        try {
          const moved = await this.mediaService.moveFromTmp(
            value,
            this.config.entityType,
            entityId,
            key,
          );
          updates[key] = moved;
        } catch (err) {
          this.logger.warn(`Failed to move tmp file for ${key}: ${err}`);
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      await this.fieldValueService.setValues(this.config.entityType, entityId, updates);
    }
  }

  /**
   * Parse file field EAV values from JSON strings back to objects in response rows.
   */
  private parseFileFields(rows: Record<string, unknown>[], defs: FieldDefinition[]): void {
    const fileFieldKeys = new Set(defs.filter(d => d.fieldType === 'file').map(d => d.fieldKey));
    if (fileFieldKeys.size === 0) return;

    for (const row of rows) {
      for (const key of fileFieldKeys) {
        const val = row[key];
        if (typeof val === 'string') {
          try {
            row[key] = JSON.parse(val);
          } catch { /* leave as-is */ }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // RESPONSE HYDRATION
  // ---------------------------------------------------------------------------

  /**
   * Hydrate relational fields in response rows:
   * - tags: fetch tags for each entity, group by tagGroupSlug, assign to correct field
   */
  private async hydrateRelationalFields(rows: Record<string, unknown>[]): Promise<void> {
    if (rows.length === 0) return;

    const defs = await this.fieldDefinitionService.listByEntityWithOptions(this.config.entityType);
    const tagFields = defs.filter(d => d.fieldType === 'tags');
    const multiFields = defs.filter(d => d.fieldType === 'multi_user' || d.fieldType === 'multi_lookup');

    // Parse file field JSON strings back to objects
    this.parseFileFields(rows, defs);

    if (tagFields.length === 0 && multiFields.length === 0) return;

    for (const row of rows) {
      const entityId = row.id as string;
      if (!entityId) continue;

      // Hydrate tag fields
      if (tagFields.length > 0) {
        const allTags = await this.taxonomyService.getTagsForEntity(this.config.entityType, entityId);
        for (const field of tagFields) {
          const fieldTags = field.tagGroupSlug
            ? allTags.filter(t => t.groupSlug === field.tagGroupSlug)
            : allTags;
          row[field.fieldKey] = fieldTags.map(t => ({ id: t.id, name: t.name, color: t.color }));
        }
      }

      // Hydrate multi-value fields (multi_user, multi_lookup)
      if (multiFields.length > 0) {
        const allMulti = await this.multiValueService.getAllForEntity(this.config.entityType, entityId);
        for (const field of multiFields) {
          const targetIds = allMulti[field.fieldKey] ?? [];
          if (targetIds.length === 0) {
            row[field.fieldKey] = [];
            continue;
          }

          // Resolve target IDs to labels via lookup resolver
          if (field.lookupEntity) {
            const labels = await this.lookupResolver.getBatchLabels(field.lookupEntity, targetIds);
            row[field.fieldKey] = targetIds.map(id => ({
              id,
              label: labels.get(id) ?? id,
            }));
          } else if (field.fieldType === 'multi_user') {
            // Resolve user IDs to names
            const users: any[] = await this.database.db
              .select({ id: sql`id`, firstName: sql`first_name`, lastName: sql`last_name` })
              .from(sql`users`)
              .where(sql`id IN (${sql.join(targetIds.map(id => sql`${id}`), sql`, `)})`);
            const userMap = new Map(users.map(u => [u.id, `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim()]));
            row[field.fieldKey] = targetIds.map(id => ({
              id,
              label: userMap.get(id) ?? id,
            }));
          } else {
            row[field.fieldKey] = targetIds.map(id => ({ id, label: id }));
          }
        }
      }
    }
  }

  /**
   * Resolve lookup field IDs to display labels in-place.
   * Adds `{fieldKey}__label` alongside the raw ID for each lookup field.
   * Uses batch resolution to minimize DB queries.
   */
  private async resolveLookupLabels(rows: Record<string, unknown>[]): Promise<void> {
    if (rows.length === 0) return;

    const defs = await this.fieldDefinitionService.listByEntityWithOptions(this.config.entityType);

    // Resolve lookup fields via lookup resolver
    const lookupFields = defs.filter(
      (d: FieldDefinition) => d.fieldType === 'lookup' && d.lookupEntity,
    );

    // Resolve user fields via users table
    const userFields = defs.filter(
      (d: FieldDefinition) => d.fieldType === 'user',
    );

    if (lookupFields.length === 0 && userFields.length === 0) return;

    // Collect unique IDs per lookup entity
    const idsByEntity = new Map<string, { fieldKey: string; ids: Set<string> }>();
    for (const field of lookupFields) {
      const entity = field.lookupEntity!;
      if (!idsByEntity.has(entity)) {
        idsByEntity.set(entity, { fieldKey: field.fieldKey, ids: new Set() });
      }
      const entry = idsByEntity.get(entity)!;
      for (const row of rows) {
        const value = row[field.fieldKey];
        if (typeof value === 'string' && value.length > 0) {
          entry.ids.add(value);
        }
      }
    }

    // Collect unique user IDs
    const userIds = new Set<string>();
    for (const field of userFields) {
      for (const row of rows) {
        const value = row[field.fieldKey];
        if (typeof value === 'string' && value.length > 0) {
          userIds.add(value);
        }
      }
    }

    // Batch resolve all lookup entities + users in parallel
    const labelMaps = new Map<string, Map<string, string>>();
    const userLabelMap = new Map<string, string>();

    const resolvePromises: Promise<void>[] = [];

    for (const [entity, { ids }] of idsByEntity.entries()) {
      if (ids.size === 0) continue;
      resolvePromises.push(
        this.lookupResolver.getBatchLabels(entity, Array.from(ids)).then(labels => {
          labelMaps.set(entity, labels);
        }),
      );
    }

    if (userIds.size > 0) {
      resolvePromises.push(
        this.database.db
          .select({ id: sql`id`, firstName: sql`first_name`, lastName: sql`last_name` })
          .from(sql`users`)
          .where(sql`id IN (${sql.join(Array.from(userIds).map(id => sql`${id}`), sql`, `)})`)
          .then((users: any[]) => {
            for (const u of users) {
              userLabelMap.set(u.id, `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim());
            }
          }),
      );
    }

    await Promise.all(resolvePromises);

    // Inject __label fields into each row
    for (const row of rows) {
      for (const field of lookupFields) {
        const value = row[field.fieldKey];
        const labelMap = labelMaps.get(field.lookupEntity!);
        if (typeof value === 'string' && labelMap) {
          row[`${field.fieldKey}__label`] = labelMap.get(value) ?? null;
        }
      }
      for (const field of userFields) {
        const value = row[field.fieldKey];
        if (typeof value === 'string' && userLabelMap.size > 0) {
          row[`${field.fieldKey}__label`] = userLabelMap.get(value) ?? null;
        }
      }
    }
  }

  /** Extract field-level data from a DB row, excluding system columns. */
  private rowToSnapshot(row: Record<string, unknown>): Record<string, unknown> {
    const systemCols = new Set(this.config.systemColumns);
    const snapshot: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (!systemCols.has(key)) {
        snapshot[key] = value;
      }
    }
    return snapshot;
  }

  /** Build a full snapshot (standard + EAV) for event payloads. */
  private async buildEntitySnapshot(row: Record<string, unknown>): Promise<Record<string, unknown>> {
    const eavValues = await this.fieldValueService.getValues(this.config.entityType, row.id as string);
    return buildSnapshot(this.rowToSnapshot(row), eavValues);
  }

  /** Merge DB row + EAV values into API response. Custom hook can override. */
  private async toResponse(
    row: Record<string, unknown>,
    preloadedEavValues?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const eavValues = preloadedEavValues ?? await this.fieldValueService.getValues(this.config.entityType, row.id as string);

    // Allow hooks to customize response
    if (this.config.hooks?.toResponse) {
      return this.config.hooks.toResponse(row, eavValues);
    }

    const standardFields = this.rowToSnapshot(row);

    return {
      ...eavValues,
      ...standardFields,
      id: row.id,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    };
  }

  /** Check uniqueness for standard DB columns that have isUnique set. */
  private async checkStandardUniqueness(
    defs: any[],
    fields: Record<string, unknown>,
    excludeId?: string,
  ): Promise<void> {
    const table = this.config.table as any;
    const uniqueStandardDefs = defs.filter((d: any) => d.isUnique && d.columnName && fields[d.fieldKey] != null);

    for (const def of uniqueStandardDefs) {
      const col = table[def.fieldKey];
      if (!col) continue;

      const conditions: any[] = [
        eq(col, fields[def.fieldKey] as any),
      ];

      if (table.deletedAt) {
        conditions.push(isNull(table.deletedAt));
      }

      const [existing] = await this.database.db
        .select({ id: table.id })
        .from(table)
        .where(and(...conditions))
        .limit(1) as any[];

      if (existing && existing.id !== excludeId) {
        throw new ConflictException(`A ${this.config.singularName.toLowerCase()} with this ${def.label.toLowerCase()} already exists`);
      }
    }
  }

  /** Check uniqueness for custom EAV fields that have isUnique set. */
  private async checkEavUniqueness(
    defs: any[],
    fields: Record<string, unknown>,
    excludeId?: string,
  ): Promise<void> {
    const uniqueEavDefs = defs.filter((d: any) => d.isUnique && !d.columnName && fields[d.fieldKey] != null);

    for (const def of uniqueEavDefs) {
      const isUnique = await this.fieldValueService.checkUniqueness(
        this.config.entityType,
        def.fieldKey,
        fields[def.fieldKey],
        excludeId,
      );
      if (!isUnique) {
        throw new ConflictException(`Value for '${def.label}' must be unique`);
      }
    }
  }
}
