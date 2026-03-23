import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { eq, and, or, isNull, ilike, asc, desc, count } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { DatabaseService } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import {
  FieldValueService,
  FieldDefinitionService,
  LookupResolverService,
  buildSnapshot,
  diffSnapshot,
  validatePayload,
  splitPayload,
} from '@packages/eav-attributes';
import type { FieldDefinition } from '@packages/eav-attributes';
import type { PaginatedResponse } from '@packages/common';
import type { EntityConfig, BaseListQuery } from './types';

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
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(`EntityService[${config.entityType}]`);
  }

  /** The entity config this service was instantiated with. */
  getConfig(): EntityConfig {
    return this.config;
  }

  // ---------------------------------------------------------------------------
  // LIST
  // ---------------------------------------------------------------------------

  async list(query: BaseListQuery): Promise<PaginatedResponse<Record<string, unknown>>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const offset = (page - 1) * limit;
    const { config } = this;

    const conditions: any[] = [];

    // Soft delete filter
    if (!query.includeDeleted && config.features?.softDelete !== false) {
      const deletedAtCol = (config.table as any).deletedAt as PgColumn | undefined;
      if (deletedAtCol) {
        conditions.push(isNull(deletedAtCol));
      }
    }

    // Search across configured columns
    if (query.search && config.searchColumns.length > 0) {
      const pattern = `%${query.search}%`;
      const searchConditions = config.searchColumns.map((col) => ilike(col, pattern));
      conditions.push(or(...searchConditions));
    }

    // Generic field-level filters (standard columns + EAV fields)
    const genericFilters = await this.buildGenericFilters(query, config);
    conditions.push(...genericFilters);

    // Custom filters from hooks (for anything not covered by generic filtering)
    if (config.hooks?.buildListFilters) {
      const extraFilters = config.hooks.buildListFilters(query);
      conditions.push(...extraFilters);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Sort
    const sortKey = query.sort ?? config.defaultSort;
    const sortColumn = config.sortableColumns[sortKey] ?? config.sortableColumns[config.defaultSort];
    const orderFn = query.order === 'asc' ? asc : desc;

    // Count
    const [{ total }] = await this.database.db
      .select({ total: count() })
      .from(config.table as any)
      .where(whereClause) as any[];

    // Fetch rows
    const rows = await this.database.db
      .select()
      .from(config.table as any)
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
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

    return {
      data,
      meta: {
        total: Number(total),
        page,
        limit,
        totalPages: Math.ceil(Number(total) / limit),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // FIND ONE
  // ---------------------------------------------------------------------------

  async findOneOrFail(id: string): Promise<Record<string, unknown>> {
    const { config } = this;
    const table = config.table as any;

    const conditions: any[] = [eq(table.id, id)];

    if (config.features?.softDelete !== false && table.deletedAt) {
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

    const response = await this.toResponse(row);
    await this.resolveLookupLabels([response]);
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

    // Split standard vs custom
    const { standardFields, customFields } = splitPayload(defs, data);

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

    this.logger.log(`${config.singularName} created`, { entityId: row.id, actorId });

    // Hook: afterCreate
    if (config.hooks?.afterCreate) {
      await config.hooks.afterCreate(row, actorId);
    }

    // Emit event
    const snapshot = await this.buildEntitySnapshot(row);
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

    // Validate (partial mode)
    const result = validatePayload(defs, data, { partial: true });
    if (!result.valid) {
      throw new BadRequestException({ message: 'Validation failed', errors: result.errors });
    }

    // Split
    const { standardFields, customFields } = splitPayload(defs, data);

    // Filter out undefined values
    const updateValues: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(standardFields)) {
      if (value !== undefined) {
        updateValues[key] = key === 'email' && typeof value === 'string' ? value.toLowerCase() : value;
      }
    }

    const hasStandardChanges = Object.keys(updateValues).length > 0;
    const hasCustomChanges = Object.keys(customFields).length > 0;

    if (!hasStandardChanges && !hasCustomChanges) {
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

    this.logger.log(`${config.singularName} updated`, { entityId: id, actorId });

    // Hook: afterUpdate
    if (config.hooks?.afterUpdate) {
      await config.hooks.afterUpdate(updated, actorId);
    }

    // Emit event after transaction
    if (eventPayload) {
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

  /** Query params that are NOT field filters — skip these in generic filtering. */
  private static readonly SYSTEM_QUERY_PARAMS = new Set([
    'page', 'limit', 'search', 'sort', 'order', 'includeDeleted',
  ]);

  /**
   * Build WHERE conditions from query params that match field definitions.
   * - Standard DB columns: eq(column, value)
   * - EAV fields: EXISTS subquery via FieldValueService.buildFilterCondition()
   */
  private async buildGenericFilters(
    query: BaseListQuery,
    config: EntityConfig,
  ): Promise<any[]> {
    // Collect filter params (exclude system params)
    const filterEntries = Object.entries(query).filter(
      ([key, value]) => !EntityService.SYSTEM_QUERY_PARAMS.has(key) && value != null && value !== '',
    );
    if (filterEntries.length === 0) return [];

    // Load field definitions to distinguish standard vs EAV
    const defs = await this.fieldDefinitionService.listByEntityWithOptions(config.entityType);
    const defsByKey = new Map(defs.map((d) => [d.fieldKey, d]));

    const conditions: any[] = [];
    const eavFilters: { fieldKey: string; operator: 'eq'; value: unknown }[] = [];
    const table = config.table as any;

    for (const [key, value] of filterEntries) {
      const def = defsByKey.get(key);
      if (!def) continue; // Not a known field — skip (let hooks handle it)

      if (def.columnName) {
        // Standard DB column — direct equality filter
        const col = table[key];
        if (col) {
          conditions.push(eq(col, value as any));
        }
      } else {
        // EAV field — collect for batch EXISTS subquery
        eavFilters.push({ fieldKey: key, operator: 'eq', value });
      }
    }

    // Build EAV filter conditions
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

  /**
   * Resolve lookup field IDs to display labels in-place.
   * Adds `{fieldKey}__label` alongside the raw ID for each lookup field.
   * Uses batch resolution to minimize DB queries.
   */
  private async resolveLookupLabels(rows: Record<string, unknown>[]): Promise<void> {
    if (rows.length === 0) return;

    // Get field definitions to identify lookup fields
    const defs = await this.fieldDefinitionService.listByEntityWithOptions(this.config.entityType);
    const lookupFields = defs.filter(
      (d: FieldDefinition) => d.fieldType === 'lookup' && d.lookupEntity,
    );
    if (lookupFields.length === 0) return;

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

    // Batch resolve all lookup entities in parallel
    const labelMaps = new Map<string, Map<string, string>>();
    await Promise.all(
      Array.from(idsByEntity.entries()).map(async ([entity, { ids }]) => {
        if (ids.size === 0) return;
        const labels = await this.lookupResolver.getBatchLabels(entity, Array.from(ids));
        labelMaps.set(entity, labels);
      }),
    );

    // Inject __label fields into each row
    for (const row of rows) {
      for (const field of lookupFields) {
        const value = row[field.fieldKey];
        const labelMap = labelMaps.get(field.lookupEntity!);
        if (typeof value === 'string' && labelMap) {
          row[`${field.fieldKey}__label`] = labelMap.get(value) ?? null;
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
