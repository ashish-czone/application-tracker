import crypto from 'crypto';
import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { eq, and, or, isNull, ilike, asc, desc, count, sql, getTableName, getTableColumns, inArray } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { withTenant, withTenantInsert, tenantCondition } from '@packages/tenancy/helpers';
import {
  buildFilterConditions,
  buildSearchCondition,
  buildSortExpression as qbBuildSortExpression,
  computePagination,
  computePaginationMeta,
  parseLegacyFilters,
  parseFilterParam,
  mergeFilters,
} from '@packages/query-builder';
import { buildSoftDeleteCondition } from '@packages/soft-delete';
import { fieldTypeRegistry } from '@packages/field-types';
import { DatabaseService } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { HierarchyService } from '@packages/hierarchy';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { FieldDefinitionService } from './services/field-definition.service';
import { LookupResolverService } from './services/lookup-resolver.service';
import type { EavStorageExtension } from './extensions/eav-storage.interface';
import type { MultiValueExtension } from './extensions/multi-value-extension.interface';
import type { FieldDefinition } from './types';
import { buildSnapshot, diffSnapshot } from './helpers/snapshot';
import { validatePayload } from './helpers/validate-payload';
import { splitPayload } from './helpers/split-payload';
import { buildClonePayload } from './helpers/build-clone-payload';
import { fieldTypeSaveHookRegistry, type FieldTypeSaveHookRegistry, type FieldTypeSaveHookContext } from './services/field-type-save-hook.registry';
import type { WorkflowExtension } from './extensions/workflow-extension.interface';
import type { TaxonomyExtension } from './extensions/taxonomy-extension.interface';
import type { PaginatedResponse } from '@packages/common';
import type { EntityConfig, BaseListQuery, ListLayoutColumn, DataAccessContext, PositionScopeProvider } from './types';
import type { SQL as DrizzleSQL } from 'drizzle-orm';
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
    private readonly eavStorage: EavStorageExtension | null,
    private readonly multiValueExtension: MultiValueExtension | null,
    private readonly fieldDefinitionService: FieldDefinitionService,
    private readonly lookupResolver: LookupResolverService,
    private readonly taxonomyExt: TaxonomyExtension | null,
    _hookRegistry: FieldTypeSaveHookRegistry, // kept for backward-compat factory signature; use singleton directly
    private readonly workflowExt: WorkflowExtension | null,
    private readonly entityRegistry: EntityRegistryService,
    appLogger: AppLoggerService,
    private readonly positionScopeProvider: PositionScopeProvider | null = null,
    private readonly hierarchyService: HierarchyService | null = null,
  ) {
    this.logger = appLogger.forContext(`EntityService[${config.entityType}]`);
  }

  /** The entity config this service was instantiated with. */
  getConfig(): EntityConfig {
    return this.config;
  }

  /**
   * Resolved extension metadata for this entity (parent table, FK column,
   * projected columns), or `undefined` for non-extension entities. Looked up
   * from the registry on every call — the registry only finalizes after
   * `onApplicationBootstrap`, so reading once in the constructor would race.
   */
  private getExtensionMeta(): import('./types').ResolvedExtension | undefined {
    return this.entityRegistry.getResolvedExtension(this.config.entityType);
  }

  /**
   * Sortable columns visible to the child — child's own + any projected
   * parent columns the parent declared sortable. The merge means a sort
   * by `priority` (a parent column) just works on the extension entity.
   */
  private getEffectiveSortableColumns(ext: import('./types').ResolvedExtension): Record<string, PgColumn> {
    const merged: Record<string, PgColumn> = { ...this.config.sortableColumns };
    const parent = this.entityRegistry.get(ext.parentEntityType);
    if (parent) {
      for (const { fieldKey, column } of ext.projectedColumns) {
        if (parent.sortableColumns[fieldKey]) merged[fieldKey] = column;
      }
    }
    return merged;
  }

  /**
   * Searchable columns visible to the child — child's own + any projected
   * parent columns the parent declared searchable. Drizzle column references
   * are stable across getTableColumns() calls, so set membership checks work.
   */
  private getEffectiveSearchColumns(ext: import('./types').ResolvedExtension): PgColumn[] {
    const parent = this.entityRegistry.get(ext.parentEntityType);
    if (!parent) return this.config.searchColumns;
    const parentSearchSet = new Set<PgColumn>(parent.searchColumns);
    const additional = ext.projectedColumns
      .filter((p) => parentSearchSet.has(p.column))
      .map((p) => p.column);
    return [...this.config.searchColumns, ...additional];
  }

  // ---------------------------------------------------------------------------
  // DATA ACCESS SCOPE RESOLUTION
  // ---------------------------------------------------------------------------

  /**
   * Resolves a data access scope into a SQL WHERE condition.
   * Built-in scopes (all, own, team) are handled by the platform.
   * Custom scopes (scope:<key>) are delegated to the entity's scope resolvers.
   */
  private async resolveDataAccessScope(ctx: DataAccessContext): Promise<DrizzleSQL | undefined> {
    const { config } = this;
    const table = config.table as any;
    const ownerField = config.dataAccess?.ownerField ?? 'createdBy';
    const ownerColumn = table[ownerField] as PgColumn | undefined;
    const teamFieldKey = config.dataAccess?.teamField;
    const teamColumn = teamFieldKey ? (table[teamFieldKey] as PgColumn | undefined) : undefined;

    if (ctx.scope === 'all') return undefined;

    if (ctx.scope === 'own') {
      if (!ownerColumn) return undefined;
      const ownerCond = eq(ownerColumn, ctx.userId);
      // For 'own' with teamField: also include records assigned to user's direct teams
      if (teamColumn && this.positionScopeProvider) {
        const unitIds = await this.positionScopeProvider.resolveOrgUnitIds(ctx.userId, 'unit');
        if (unitIds && unitIds.length > 0) {
          return or(ownerCond, inArray(teamColumn, unitIds))!;
        }
      }
      return ownerCond;
    }

    // Position-based scopes: 'descendants' and 'unit'
    if (ctx.scope === 'descendants' || ctx.scope === 'unit') {
      if (!this.positionScopeProvider) {
        if (!ownerColumn) return undefined;
        return eq(ownerColumn, ctx.userId);
      }

      const conditions: DrizzleSQL[] = [];

      // Owner-based filtering
      if (ownerColumn) {
        const userIds = await this.positionScopeProvider.resolveUserIds(ctx.userId, ctx.scope);
        if (!userIds) return undefined; // null = no filter
        conditions.push(userIds.length > 0 ? inArray(ownerColumn, userIds) : eq(ownerColumn, ctx.userId));
      }

      // Team-based filtering
      if (teamColumn) {
        const unitIds = await this.positionScopeProvider.resolveOrgUnitIds(ctx.userId, ctx.scope);
        if (unitIds === null) return conditions.length > 0 ? conditions[0] : undefined; // null = no filter on team
        if (unitIds.length > 0) {
          conditions.push(inArray(teamColumn, unitIds));
        }
      }

      if (conditions.length === 0) return undefined;
      if (conditions.length === 1) return conditions[0];
      return or(...conditions)!;
    }

    // Custom scope: 'scope:<key>' (legacy format) or plain key (new format from positions)
    const scopeKey = ctx.scope.startsWith('scope:') ? ctx.scope.slice(6) : ctx.scope;
    const resolver = config.dataAccess?.scopes?.find((s) => s.key === scopeKey);
    if (resolver) {
      return resolver.resolve(ctx.userId);
    }

    // Unknown scope — fail closed (own)
    this.logger.warn(`Unknown data access scope: ${ctx.scope}, falling back to 'own'`);
    if (!ownerColumn) return undefined;
    return eq(ownerColumn, ctx.userId);
  }

  // ---------------------------------------------------------------------------
  // LIST LAYOUT
  // ---------------------------------------------------------------------------

  /** Check if a field type should be excluded from list views (via field type registry). */
  private static shouldExcludeFromList(fieldType: string): boolean {
    const ft = fieldTypeRegistry.get(fieldType);
    return ft?.excludeFromList ?? false;
  }

  /** Check if a field instance is explicitly excluded from list views via fieldMeta. */
  private isFieldExcludedFromList(fieldKey: string): boolean {
    return this.config.fieldMeta[fieldKey]?.excludeFromList ?? false;
  }


  /** Collect source fields from all computed columns (e.g. firstName/lastName hidden when fullName exists). */
  private getCompositeNameFields(): Set<string> {
    const fields = new Set<string>();
    for (const col of this.config.computedColumns ?? []) {
      if (col.sourceFields) {
        for (const f of col.sourceFields) fields.add(f);
      }
    }
    return fields;
  }

  /** System columns always included in list queries. */
  private static readonly LIST_SYSTEM_COLUMNS = ['id', 'createdAt', 'updatedAt', 'deletedAt', 'createdBy'];

  /**
   * Get all field definitions eligible for list queries.
   * Excludes long-text/file types and system fields — unless the system field
   * is explicitly in listFields or has a cellRenderer configured.
   */
  private async getListFieldDefs(): Promise<FieldDefinition[]> {
    const { config } = this;
    const defs = await this.fieldDefinitionService.listByEntityWithOptions(config.entityType);
    const listFieldSet = config.listFields ? new Set(config.listFields) : null;
    const compositeNameFields = this.getCompositeNameFields();
    return defs.filter(d => {
      if (EntityService.shouldExcludeFromList(d.fieldType)) return false;
      if (this.isFieldExcludedFromList(d.fieldKey)) return false;
      if (compositeNameFields.has(d.fieldKey)) return false;
      if (!d.isSystem) return true;
      return listFieldSet?.has(d.fieldKey) || !!config.fieldMeta[d.fieldKey]?.cellRenderer;
    });
  }

  /**
   * Build a Drizzle select map for list queries — only standard DB columns
   * that appear in the list layout + required system columns.
   *
   * For extension entities (`extensionOf`), the child table has no `id`
   * column of its own — the FK column doubles as the PK and shares the
   * parent's id value. We alias `child.fk → 'id'` so callers always see
   * an `id` field, then layer in the projected parent columns. Per-key
   * conflicts resolve in favor of the child (its own column wins).
   */
  private buildListSelectMap(
    listDefs: FieldDefinition[],
    ext?: import('./types').ResolvedExtension,
  ): Record<string, PgColumn> {
    const table = this.config.table as any;
    const selectMap: Record<string, PgColumn> = {};

    const resolveColumn = (key: string): PgColumn | undefined => {
      if (table[key]) return table[key] as PgColumn;
      if (ext) {
        const parentTable = ext.parentTable as any;
        if (parentTable[key]) return parentTable[key] as PgColumn;
      }
      return undefined;
    };

    if (ext) {
      // Extensions never have their own `id` column — alias the FK.
      selectMap.id = ext.foreignKeyColumn;
    }

    for (const key of EntityService.LIST_SYSTEM_COLUMNS) {
      if (key === 'id' && ext) continue; // already aliased
      const col = resolveColumn(key);
      if (col) selectMap[key] = col;
    }

    // Always include nameField and subtitleField (needed for display even if system/hidden)
    const { nameField, subtitleField } = this.config.ui;
    const displayFields = Array.isArray(nameField) ? [...nameField] : [nameField];
    if (subtitleField) displayFields.push(subtitleField);
    for (const key of displayFields) {
      const col = resolveColumn(key);
      if (col) selectMap[key] = col;
    }

    for (const def of listDefs) {
      if (def.columnName !== null && table[def.fieldKey]) {
        selectMap[def.fieldKey] = table[def.fieldKey];
      }
    }

    // Layer projected parent columns last — child fields with the same key
    // already won via the loop above, so this is purely additive.
    if (ext) {
      for (const { fieldKey, column } of ext.projectedColumns) {
        if (!(fieldKey in selectMap)) selectMap[fieldKey] = column;
      }
    }

    return selectMap;
  }

  /**
   * Build all computed SQL expressions for SELECT: relationship counts + explicit computed columns.
   * Unified pipeline — both relationship counts and custom subqueries go through the same path.
   */
  private buildComputedExpressions(): Record<string, any> {
    const { config } = this;
    const exprs: Record<string, any> = {};
    const thisTableName = getTableName(config.table);

    // Auto-derive COUNT subqueries from hasMany relationships
    for (const rel of config.relationships ?? []) {
      if (rel.type !== 'hasMany' || !rel.foreignKey) continue;

      const fkColumn = rel.foreignKey.replace(/[A-Z]/g, (c: string) => `_${c.toLowerCase()}`);
      const targetTableName = rel.targetEntity;
      const key = `${rel.name}Count`;

      exprs[key] = sql`(SELECT COUNT(*)::integer FROM ${sql.raw(`"${targetTableName}"`)} WHERE ${sql.raw(`"${fkColumn}"`)} = ${sql.raw(`"${thisTableName}"."id"`)} AND "deleted_at" IS NULL AND ${tenantCondition()})`;
    }

    // Explicit computed columns (e.g., evaluation averages)
    for (const col of config.computedColumns ?? []) {
      exprs[col.name] = col.expression;
    }

    return exprs;
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
      .filter(d => {
        if (EntityService.shouldExcludeFromList(d.fieldType)) return false;
        if (this.isFieldExcludedFromList(d.fieldKey)) return false;
        if (config.fieldMeta[d.fieldKey]?.listColumnHidden) return false;
        if (!d.isSystem) return true;
        // System fields can appear if explicitly listed or have a custom cell renderer
        return listFieldSet?.has(d.fieldKey) || !!config.fieldMeta[d.fieldKey]?.cellRenderer;
      })
      .map((d, idx) => ({
        fieldKey: d.fieldKey,
        label: d.label,
        fieldType: d.fieldType,
        sortable: !!config.sortableColumns[d.fieldKey],
        lookupEntity: d.lookupEntity ?? undefined,
        visible: listFieldSet ? listFieldSet.has(d.fieldKey) : !EntityService.shouldExcludeFromList(d.fieldType) && idx < 10,
        order: listFieldOrder?.get(d.fieldKey) ?? 1000 + idx,
        picklistOptions: (d.fieldType === 'picklist' || d.fieldType === 'multi_select') && d.picklistOptions?.length
          ? d.picklistOptions.map(o => ({ label: o.label, value: o.value }))
          : undefined,
        operators: fieldTypeRegistry.get(d.fieldType)?.filterOperators ?? [],
        tagGroupSlug: d.fieldType === 'tags' ? (d.tagGroupSlug ?? undefined) : undefined,
        categoryGroupSlug: d.fieldType === 'category' ? (d.categoryGroupSlug ?? undefined) : undefined,
        cellRenderer: config.fieldMeta[d.fieldKey]?.cellRenderer,
      }));

    // Append computed columns: relationship counts + explicit computed columns
    // Relationship counts auto-derive label from relationship config.
    // Explicit computed columns derive label/cellRenderer from fieldMeta.
    for (const rel of config.relationships ?? []) {
      if (rel.type !== 'hasMany' || !rel.foreignKey) continue;
      const key = `${rel.name}Count`;
      const meta = config.fieldMeta[key];
      columns.push({
        fieldKey: key,
        label: meta?.label ?? `${rel.label} Count`,
        fieldType: meta?.fieldType ?? 'number',
        sortable: true,
        lookupEntity: undefined,
        visible: listFieldSet ? listFieldSet.has(key) : false,
        order: listFieldOrder?.get(key) ?? 2000,
        cellRenderer: meta?.cellRenderer,
        relationship: {
          targetEntity: rel.targetEntity,
          foreignKey: rel.foreignKey,
        },
      });
    }
    for (const col of config.computedColumns ?? []) {
      const meta = config.fieldMeta[col.name];
      columns.push({
        fieldKey: col.name,
        label: meta?.label ?? col.name,
        fieldType: meta?.fieldType ?? 'number',
        sortable: true,
        lookupEntity: undefined,
        visible: listFieldSet ? listFieldSet.has(col.name) : false,
        order: listFieldOrder?.get(col.name) ?? 2500,
        picklistOptions: meta?.picklistOptions as any,
        cellRenderer: meta?.cellRenderer,
      });
    }

    // Sort by order
    columns.sort((a, b) => a.order - b.order);

    // Build filterable fields (picklists, lookups, booleans, tags)
    const defs = await this.fieldDefinitionService.listByEntityWithOptions(config.entityType);
    const filters = defs
      .filter(d => {
        const ft = fieldTypeRegistry.get(d.fieldType);
        return ft?.filterable ?? false;
      })
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

  async list(query: BaseListQuery, accessCtx?: DataAccessContext): Promise<PaginatedResponse<Record<string, unknown>>> {
    const { page, limit, offset } = computePagination({
      page: query.page ?? 1,
      limit: query.limit ?? 25,
    });
    const { config } = this;
    const ext = this.getExtensionMeta();
    // For extension entities, soft-delete + tenant scope live on the parent
    // table (the child has neither column). Compute the scope-target table
    // once so every helper picks the right table.
    const scopeTable = ext ? (ext.parentTable as any) : (config.table as any);

    const conditions: any[] = [];

    // Data access scope filtering
    if (accessCtx) {
      const scopeCondition = await this.resolveDataAccessScope(accessCtx);
      if (scopeCondition) conditions.push(scopeCondition);
    }

    // Soft delete filter (delegated to @packages/soft-delete)
    const softDeleteCond = buildSoftDeleteCondition(scopeTable, query.includeDeleted ?? false);
    if (softDeleteCond) conditions.push(softDeleteCond);

    // Search across configured columns + lookup field labels.
    // For extensions, projected parent columns marked searchable on the
    // parent participate transparently.
    if (query.search) {
      const searchConditions: any[] = [];

      const searchCols = ext ? this.getEffectiveSearchColumns(ext) : config.searchColumns;
      const stdSearch = buildSearchCondition(query.search, searchCols);
      if (stdSearch) searchConditions.push(stdSearch);

      // Lookup field search — entity-specific, stays here
      const lookupSearchConds = this.buildLookupSearchConditions(query.search);
      searchConditions.push(...lookupSearchConds);

      if (searchConditions.length > 0) {
        conditions.push(or(...searchConditions));
      }
    }

    // Generic field-level filters (delegated to query-builder + EAV routing)
    const filterConditions = await this.buildAllFilters(query, config, ext);
    conditions.push(...filterConditions);

    // Custom filters from hooks (for anything not covered by generic filtering)
    if (config.hooks?.buildListFilters) {
      const extraFilters = config.hooks.buildListFilters(query);
      conditions.push(...extraFilters);
    }

    const whereClause = conditions.length > 0
      ? withTenant(scopeTable, and(...conditions))
      : withTenant(scopeTable);

    // Sort — check if the sort key is a lookup field, use label subquery if so
    const sortKey = query.sort ?? config.defaultSort;
    const orderDirection = query.order === 'asc' ? 'ASC' : 'DESC';
    const orderByExpr = this.buildSortExpression(sortKey, orderDirection, config);

    // Count
    const countQuery = this.database.db
      .select({ total: count() })
      .from(config.table as any) as any;
    if (ext) countQuery.innerJoin(ext.parentTable, eq(ext.parentIdColumn, ext.foreignKeyColumn));
    const [{ total }] = await countQuery.where(whereClause) as any[];

    // Fetch only list-relevant columns instead of SELECT *
    const listDefs = await this.getListFieldDefs();
    const selectMap: Record<string, any> = this.buildListSelectMap(listDefs, ext);

    // Add computed expressions (relationship counts + explicit computed columns).
    // Skipped for extensions in PR 1: count subqueries reference `<child>.id`
    // which doesn't exist on the child table. Revisit when an extension wants
    // its own computed columns.
    if (!ext) Object.assign(selectMap, this.buildComputedExpressions());

    const baseSelect = this.database.db
      .select(selectMap)
      .from(config.table as any) as any;
    if (ext) baseSelect.innerJoin(ext.parentTable, eq(ext.parentIdColumn, ext.foreignKeyColumn));
    const rows = await baseSelect
      .where(whereClause)
      .orderBy(orderByExpr)
      .limit(limit)
      .offset(offset);

    // Batch-hydrate EAV values
    const entityIds = rows.map((r: any) => r.id);
    const eavMap = entityIds.length > 0 && this.eavStorage
      ? await this.eavStorage.getBatchValues(config.entityType, entityIds)
      : new Map<string, Record<string, unknown>>();

    const data = await Promise.all(
      rows.map((row: any) => this.toResponse(row, eavMap?.get(row.id))),
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

  async findOneOrFail(id: string, accessCtx?: DataAccessContext): Promise<Record<string, unknown>> {
    const { config } = this;
    const table = config.table as any;
    const ext = this.getExtensionMeta();
    const scopeTable = ext ? (ext.parentTable as any) : table;
    // Identity column on the child — for extensions the FK is also the PK
    // and shares the parent's id value, so `eq(fk, id)` is the right shape.
    const idColumn = ext ? ext.foreignKeyColumn : (table.id as PgColumn);

    const conditions: any[] = [eq(idColumn, id)];

    const softDeleteCond = buildSoftDeleteCondition(scopeTable);
    if (softDeleteCond) conditions.push(softDeleteCond);

    // Data access scope filtering — ensures user can only view records within their scope
    if (accessCtx) {
      const scopeCondition = await this.resolveDataAccessScope(accessCtx);
      if (scopeCondition) conditions.push(scopeCondition);
    }

    if (ext) {
      // Extension reads project parent columns into the response, so build a
      // selectMap explicitly instead of `select()` (which returns child only).
      const selectMap: Record<string, any> = this.buildListSelectMap([], ext);
      // Detail reads want every child column too, not just system + projected.
      for (const [k, col] of Object.entries(getTableColumns(config.table))) {
        if (!(k in selectMap)) selectMap[k] = col as PgColumn;
      }
      const [row] = await this.database.db
        .select(selectMap)
        .from(table)
        .innerJoin(ext.parentTable, eq(ext.parentIdColumn, ext.foreignKeyColumn))
        .where(withTenant(scopeTable, ...conditions))
        .limit(1) as any[];

      if (!row) {
        throw new NotFoundException(`${config.singularName} not found`);
      }

      const response = await this.toResponse(row);
      await this.resolveLookupLabels([response]);
      await this.hydrateRelationalFields([response]);
      return response;
    }

    const [row] = await this.database.db
      .select()
      .from(table)
      .where(withTenant(table, ...conditions))
      .limit(1) as any[];

    if (!row) {
      throw new NotFoundException(`${config.singularName} not found`);
    }

    // Compute relationship counts + computed columns for detail view
    const computedExprs = this.buildComputedExpressions();
    if (Object.keys(computedExprs).length > 0) {
      const [computedRow] = await this.database.db
        .select(computedExprs)
        .from(table)
        .where(withTenant(table, eq(table.id, id)))
        .limit(1) as any[];
      if (computedRow) Object.assign(row, computedRow);
    }

    const response = await this.toResponse(row);
    await this.resolveLookupLabels([response]);
    await this.hydrateRelationalFields([response]);
    return response;
  }

  // ---------------------------------------------------------------------------
  // HIERARCHY
  // ---------------------------------------------------------------------------

  private assertHierarchyEnabled(): HierarchyService {
    if (!this.config.hierarchy || !this.hierarchyService) {
      throw new BadRequestException(
        `${this.config.singularName} does not support hierarchy operations`,
      );
    }
    return this.hierarchyService;
  }

  /**
   * Move a node (and its entire subtree) under a new parent.
   * Pass `newParentId: null` to make the node a root.
   * Delegates cycle detection and path updates to HierarchyService.
   */
  async reparent(
    id: string,
    newParentId: string | null,
    actorId: string,
    accessCtx?: DataAccessContext,
  ): Promise<Record<string, unknown>> {
    const hierarchy = this.assertHierarchyEnabled();
    const { config } = this;
    const table = config.table as any;

    // Scope check + fetch current row for its path
    await this.findOneOrFail(id, accessCtx);
    const [node] = await this.database.db
      .select()
      .from(table)
      .where(withTenant(table, eq(table.id, id)))
      .limit(1) as any[];

    let newParentPath: string | null = null;
    if (newParentId) {
      const [parent] = await this.database.db
        .select()
        .from(table)
        .where(withTenant(table, eq(table.id, newParentId)))
        .limit(1) as any[];
      if (!parent) {
        throw new NotFoundException(`Parent ${config.singularName} not found: ${newParentId}`);
      }
      newParentPath = parent.path as string;
    }

    await hierarchy.move(
      table,
      table.id,
      table.parentId,
      table.path,
      table.depth,
      id,
      node.path as string,
      newParentId,
      newParentPath,
    );

    this.logger.log(`${config.singularName} reparented`, { entityId: id, newParentId, actorId });
    return this.findOneOrFail(id, accessCtx);
  }

  /**
   * Get all ancestors of a node (root first, parent last). Excludes the node itself.
   */
  async getAncestors(id: string, accessCtx?: DataAccessContext): Promise<Record<string, unknown>[]> {
    const hierarchy = this.assertHierarchyEnabled();
    const { config } = this;
    const table = config.table as any;

    const node = await this.findOneOrFail(id, accessCtx);
    const rows = await hierarchy.getAncestors(table, table.id, table.path, node.path as string);
    return Promise.all(rows.map((r) => this.toResponse(r)));
  }

  /**
   * Get all descendants of a node. Excludes the node itself.
   */
  async getDescendants(id: string, accessCtx?: DataAccessContext): Promise<Record<string, unknown>[]> {
    const hierarchy = this.assertHierarchyEnabled();
    const { config } = this;
    const table = config.table as any;

    const node = await this.findOneOrFail(id, accessCtx);
    const rows = await hierarchy.getDescendants(table, table.path, node.path as string);
    return Promise.all(rows.map((r) => this.toResponse(r)));
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

    // Pre-generate entity ID so onBeforeSave hooks can use it (e.g. file paths)
    const entityId = crypto.randomUUID();

    // Hierarchy: compute path + depth from the parent's path before insert.
    // Must happen after splitPayload (so parentId is in standardFields) and
    // before the insert so path/depth land on the inserted row.
    if (config.hierarchy && this.hierarchyService) {
      const parentId = standardFields.parentId as string | null | undefined;
      let parentPath: string | null = null;
      if (parentId) {
        const table = config.table as any;
        const [parent] = await this.database.db
          .select()
          .from(table)
          .where(withTenant(table, eq(table.id, parentId)))
          .limit(1) as any[];
        if (!parent) {
          throw new BadRequestException(`Parent ${config.singularName} not found: ${parentId}`);
        }
        parentPath = parent.path as string;
      }
      const { path, depth } = this.hierarchyService.computeInsertValues(parentPath, entityId);
      standardFields.path = path;
      standardFields.depth = depth;
    }

    // Phase 1: onBeforeSave hooks (pre-transaction, can throw to abort)
    const allFields = { ...customFields, ...relationalFields };
    const defMap = new Map(defs.map(d => [d.fieldKey, d]));
    for (const [key, value] of Object.entries(allFields)) {
      const def = defMap.get(key);
      if (!def) continue;
      const hooks = fieldTypeSaveHookRegistry.get(def.fieldType);
      if (hooks?.onBeforeSave) {
        const ctx: FieldTypeSaveHookContext = {
          entityType: config.entityType, entityId, fieldKey: key,
          fieldType: def.fieldType, mode: 'create', actorId,
        };
        const result = await hooks.onBeforeSave(value, ctx);
        if (result.transformedValue !== undefined) {
          if (key in customFields) customFields[key] = result.transformedValue;
          if (key in relationalFields) relationalFields[key] = result.transformedValue;
        }
      }
    }

    // Phase 2: Transaction (entity row + EAV + relational writes)
    const row = await this.database.db.transaction(async (tx) => {
      const result = await tx
        .insert(config.table as any)
        .values(withTenantInsert(config.table as any, { id: entityId, ...standardFields, createdBy: actorId }) as any)
        .returning() as any[];
      const inserted = result[0];

      if (Object.keys(customFields).length > 0 && this.eavStorage) {
        await this.eavStorage.setValues(config.entityType, inserted.id, customFields, tx);
      }

      // Relational writes inside the transaction
      for (const [key, value] of Object.entries(relationalFields)) {
        const def = defMap.get(key);
        if (!def) continue;
        const hooks = fieldTypeSaveHookRegistry.get(def.fieldType);
        if (hooks?.onTransactionalSave) {
          const ctx: FieldTypeSaveHookContext = {
            entityType: config.entityType, entityId: inserted.id, fieldKey: key,
            fieldType: def.fieldType, mode: 'create', actorId,
          };
          await hooks.onTransactionalSave(value, ctx, tx);
        }
      }

      return inserted;
    });

    // Phase 3: onAfterSave hooks (fire-and-forget)
    for (const [key, value] of Object.entries(allFields)) {
      const def = defMap.get(key);
      if (!def) continue;
      const hooks = fieldTypeSaveHookRegistry.get(def.fieldType);
      if (hooks?.onAfterSave) {
        const ctx: FieldTypeSaveHookContext = {
          entityType: config.entityType, entityId: row.id, fieldKey: key,
          fieldType: def.fieldType, mode: 'create', actorId,
        };
        hooks.onAfterSave(value, ctx).catch(err =>
          this.logger.warn(`onAfterSave hook failed for ${def.fieldType}/${key}: ${err}`),
        );
      }
    }

    // Auto-assign pipeline for entities with workflow discriminators
    for (const [fieldKey, meta] of Object.entries(config.fieldMeta)) {
      if (meta.fieldType === 'workflow' && meta.workflow?.discriminator) {
        const discriminator = meta.workflow.discriminator;
        try {
          const findEntity = async (entityType: string, entityId: string) => {
            const targetConfig = this.entityRegistry.get(entityType);
            if (!targetConfig) return {};
            const [found] = await this.database.db
              .select()
              .from(targetConfig.table as any)
              .where(withTenant(targetConfig.table as any, eq((targetConfig.table as any).id, entityId)))
              .limit(1) as any[];
            return found ?? {};
          };
          const findCategory = async (categoryId: string) => {
            const [found] = await this.database.db
              .select({ id: sql`id`, name: sql`name`, slug: sql`slug` })
              .from(sql`categories`)
              .where(sql`id = ${categoryId} AND ${tenantCondition()}`)
              .limit(1) as { id: string; name: string; slug: string }[];
            return found ?? null;
          };
          const value = await discriminator.resolve(
            { ...standardFields, ...customFields, id: row.id },
            { findEntity, findCategory },
          );
          await this.workflowExt?.resolveAndAssign(config.entityType, row.id, fieldKey, value);
        } catch (err) {
          this.logger.warn(`Failed to resolve pipeline discriminator for ${config.entityType}/${row.id}: ${(err as Error).message}`);
        }
      }
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

  async update(id: string, payload: Record<string, unknown>, actorId: string, accessCtx?: DataAccessContext): Promise<Record<string, unknown>> {
    const { config } = this;
    const table = config.table as any;

    // Ensure entity exists and is within the actor's scope
    await this.findOneOrFail(id, accessCtx);

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

    // Phase 1: onBeforeSave hooks (pre-transaction, can throw to abort)
    const allUpdateFields = { ...customFields, ...relationalFields };
    const updateDefMap = new Map(defs.map(d => [d.fieldKey, d]));
    for (const [key, value] of Object.entries(allUpdateFields)) {
      const def = updateDefMap.get(key);
      if (!def) continue;
      const hooks = fieldTypeSaveHookRegistry.get(def.fieldType);
      if (hooks?.onBeforeSave) {
        const ctx: FieldTypeSaveHookContext = {
          entityType: config.entityType, entityId: id, fieldKey: key,
          fieldType: def.fieldType, mode: 'update', actorId,
        };
        const result = await hooks.onBeforeSave(value, ctx);
        if (result.transformedValue !== undefined) {
          if (key in customFields) customFields[key] = result.transformedValue;
          if (key in relationalFields) relationalFields[key] = result.transformedValue;
        }
      }
    }

    let eventPayload: { changes: string[]; before: Record<string, unknown>; after: Record<string, unknown> } | null = null;

    // Phase 2: Transaction (entity row + EAV + relational writes)
    const updated = await this.database.db.transaction(async (tx) => {
      // Read before snapshot inside tx for consistency
      const eavBefore = this.eavStorage ? await this.eavStorage.getValues(config.entityType, id, tx) : {};
      const [existingRow] = await tx.select().from(table).where(withTenant(table, eq(table.id, id))).limit(1) as any[];
      const before = buildSnapshot(this.rowToSnapshot(existingRow), eavBefore);

      // Update standard columns
      let row = existingRow;
      if (hasStandardChanges) {
        const [updatedRow] = await tx
          .update(table)
          .set(updateValues)
          .where(withTenant(table, eq(table.id, id)))
          .returning() as any[];
        row = updatedRow;
      }

      // Update EAV values
      let eavAfter = eavBefore;
      if (hasCustomChanges && this.eavStorage) {
        const eavResult = await this.eavStorage.setValues(config.entityType, id, customFields, tx);
        eavAfter = eavResult.after;
      }

      // Relational writes inside the transaction
      if (hasRelationalChanges) {
        for (const [key, value] of Object.entries(relationalFields)) {
          const def = updateDefMap.get(key);
          if (!def) continue;
          const hooks = fieldTypeSaveHookRegistry.get(def.fieldType);
          if (hooks?.onTransactionalSave) {
            const ctx: FieldTypeSaveHookContext = {
              entityType: config.entityType, entityId: id, fieldKey: key,
              fieldType: def.fieldType, mode: 'update', actorId,
            };
            await hooks.onTransactionalSave(value, ctx, tx);
          }
        }
      }

      const after = buildSnapshot(this.rowToSnapshot(row), eavAfter);
      const changes = diffSnapshot(before, after);

      if (changes.length > 0) {
        eventPayload = { changes, before, after };
      }

      return row;
    });

    // Phase 3: onAfterSave hooks (fire-and-forget)
    for (const [key, value] of Object.entries(allUpdateFields)) {
      const def = updateDefMap.get(key);
      if (!def) continue;
      const hooks = fieldTypeSaveHookRegistry.get(def.fieldType);
      if (hooks?.onAfterSave) {
        const ctx: FieldTypeSaveHookContext = {
          entityType: config.entityType, entityId: id, fieldKey: key,
          fieldType: def.fieldType, mode: 'update', actorId,
        };
        hooks.onAfterSave(value, ctx).catch(err =>
          this.logger.warn(`onAfterSave hook failed for ${def.fieldType}/${key}: ${err}`),
        );
      }
    }

    this.logger.log(`${config.singularName} updated`, { entityId: id, actorId });

    // Hook: afterUpdate
    if (config.hooks?.afterUpdate) {
      await config.hooks.afterUpdate(updated, actorId);
    }

    // Emit event after transaction (with resolved lookup labels for audit readability)
    if (eventPayload != null) {
      const payload = eventPayload as { changes: string[]; before: Record<string, unknown>; after: Record<string, unknown> };
      await this.resolveLookupLabels([payload.before, payload.after]);
      this.domainEventEmitter.emitDynamic(`${config.entityType}.Updated`, {
        entityType: config.entityType,
        entityId: id,
        actorId,
        payload,
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
    options?: { reason?: string; comment?: string },
    accessCtx?: DataAccessContext,
  ): Promise<Record<string, unknown>> {
    const { config } = this;
    const table = config.table as any;
    const reason = options?.reason;
    const comment = options?.comment;

    // 1. Get current entity (scope-checked)
    const entity = await this.findOneOrFail(id, accessCtx);

    // 2. Look up workflow — check assignment first, fall back to default
    if (!this.workflowExt) {
      throw new BadRequestException(`Workflow extension is not loaded — cannot transition field '${fieldKey}'`);
    }
    const workflow = await this.workflowExt.resolveForTransition(config.entityType, id, fieldKey);
    if (!workflow) {
      throw new BadRequestException(`No workflow found for field '${fieldKey}' on '${config.entityType}'`);
    }

    const currentState = entity[fieldKey] as string | null;
    if (!currentState) {
      throw new BadRequestException(`Entity has no current state for field '${fieldKey}'`);
    }

    // 3. Validate transition (permissions, guards, conditions) — throws on failure
    const validated = await this.workflowExt.validateAndThrow({
      workflowSlug: workflow.slug,
      entityType: config.entityType,
      entityId: id,
      fromState: currentState,
      toState,
      actorId,
      entityData: entity as Record<string, unknown>,
    });

    // 3b. Validate reason/comment against transition definition
    const transitionDef = workflow.transitions.find((t) => t.id === validated.transitionId);
    if (transitionDef) {
      if (transitionDef.reasonRequired && !reason) {
        throw new BadRequestException('A reason is required for this transition');
      }
      if (transitionDef.commentRequired && !comment) {
        throw new BadRequestException('A comment is required for this transition');
      }
      if (reason && transitionDef.reasonOptions && transitionDef.reasonOptions.length > 0) {
        if (!transitionDef.reasonOptions.includes(reason)) {
          throw new BadRequestException(`Invalid reason. Must be one of: ${transitionDef.reasonOptions.join(', ')}`);
        }
      }
    }

    // 4. Update entity field + record history in a single transaction
    const col = table[fieldKey];
    await this.database.db.transaction(async (tx) => {
      if (col) {
        await tx
          .update(table)
          .set({ [fieldKey]: toState })
          .where(withTenant(table, eq(table.id, id)));
      } else if (this.eavStorage) {
        await this.eavStorage.setValues(config.entityType, id, { [fieldKey]: toState }, tx);
      }

      await this.workflowExt!.recordHistory({
        workflowDefinitionId: validated.workflowDefinitionId,
        entityType: config.entityType,
        entityId: id,
        fieldName: validated.fieldName,
        fromState: currentState,
        toState,
        transitionId: validated.transitionId,
        actorId,
        reason,
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
        reason,
        comment,
      },
    });

    return this.findOneOrFail(id);
  }

  // ---------------------------------------------------------------------------
  // CLONE
  // ---------------------------------------------------------------------------

  async clone(id: string, actorId: string): Promise<Record<string, unknown>> {
    const { config } = this;

    // 1. Fetch source entity (full hydrated response with relational fields)
    const source = await this.findOneOrFail(id);

    // 2. Load field definitions
    const defs = await this.fieldDefinitionService.listByEntityWithOptions(config.entityType);

    // 3. Build clone payload (pure function — skips auto/readonly/workflow, transforms relational fields)
    const nameField = config.ui.nameField;
    const primaryNameField = Array.isArray(nameField) ? nameField[0] : nameField;
    const clonePayload = buildClonePayload(source, defs, primaryNameField);

    // 4. Delegate to create() — reuses validation, hooks, events, pipeline assignment
    return this.create(clonePayload, actorId);
  }

  // ---------------------------------------------------------------------------
  // SOFT DELETE
  // ---------------------------------------------------------------------------

  async softDelete(id: string, actorId: string, accessCtx?: DataAccessContext): Promise<void> {
    const { config } = this;
    const entity = await this.findOneOrFail(id, accessCtx);

    // Hook: beforeDelete
    if (config.hooks?.beforeDelete) {
      await config.hooks.beforeDelete(id, actorId);
    }

    await this.database.db
      .update(config.table as any)
      .set({ deletedAt: new Date(), deletedBy: actorId } as any)
      .where(withTenant(config.table as any, eq((config.table as any).id, id)));

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
      .where(withTenant(table, eq(table.id, id)))
      .limit(1) as any[];

    if (!row) {
      throw new NotFoundException(`${config.singularName} not found`);
    }

    const [restored] = await this.database.db
      .update(table)
      .set({ deletedAt: null, deletedBy: null } as any)
      .where(withTenant(table, eq(table.id, id)))
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
   * For extension entities, projected parent columns flagged sortable on
   * the parent are merged into the sortable set so a sort by, say, `priority`
   * (which lives on the parent) just works on the child.
   */
  private buildSortExpression(sortKey: string, direction: 'ASC' | 'DESC', config: EntityConfig): any {
    const ext = this.getExtensionMeta();
    // Computed expressions are skipped for extension entities (see note in
    // list()); only consult them for non-extension entities.
    if (!ext) {
      const computedExprs = this.buildComputedExpressions();
      if (computedExprs[sortKey]) {
        return sql`${computedExprs[sortKey]} ${sql.raw(direction)}`;
      }
    }

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

    const sortableColumns = ext
      ? this.getEffectiveSortableColumns(ext)
      : config.sortableColumns;

    // Standard column sort (delegated to query-builder)
    return qbBuildSortExpression(
      sortKey,
      direction === 'ASC' ? 'asc' : 'desc',
      sortableColumns,
      config.defaultSort,
    );
  }

  /**
   * Build all filter conditions from legacy query params.
   * Resolves standard DB columns via query-builder, routes EAV fields to FieldValueService.
   * For extension entities, projected parent columns are added to the column
   * map so a filter like `?status=open` routes to `parent.status`.
   */
  private async buildAllFilters(
    query: BaseListQuery,
    config: EntityConfig,
    ext?: import('./types').ResolvedExtension,
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

    // Layer projected parent columns. Child columns of the same name win
    // (they were inserted above), so this is purely additive.
    if (ext) {
      for (const { fieldKey, column } of ext.projectedColumns) {
        if (!(fieldKey in columnMap)) columnMap[fieldKey] = column;
      }
    }

    // Resolve standard column filters via query-builder
    const { conditions, unresolved } = buildFilterConditions(allFilters, columnMap);

    // Classify unresolved filters into EAV vs relational
    const defsByKey = new Map(defs.map((d) => [d.fieldKey, d]));
    const eavFilters: { fieldKey: string; operator: any; value: any }[] = [];

    for (const f of unresolved) {
      const def = defsByKey.get(f.field);
      if (!def) continue;

      if (fieldTypeRegistry.isRelational(def.fieldType)) {
        // Relational fields: build EXISTS subquery against junction tables
        const relCondition = this.buildRelationalFilterCondition(
          config.entityType,
          table.id,
          def,
          f.operator,
          f.value,
        );
        if (relCondition) conditions.push(relCondition);
      } else if (!def.columnName) {
        // EAV fields: route to FieldValueService
        eavFilters.push({ fieldKey: f.field, operator: f.operator, value: f.value });
      }
    }

    if (eavFilters.length > 0 && this.eavStorage) {
      const eavCondition = this.eavStorage.buildFilterCondition(
        config.entityType,
        table.id,
        eavFilters,
      );
      conditions.push(eavCondition);
    }

    return conditions;
  }

  /**
   * Build an EXISTS subquery condition for a relational field (tags, multi_user, multi_lookup).
   *
   * - tags: EXISTS (SELECT 1 FROM entity_tags WHERE entity_type = ? AND entity_id = <id> AND tag_id = ?)
   * - multi_user/multi_lookup: EXISTS (SELECT 1 FROM entity_multi_values WHERE entity_type = ? AND entity_id = <id> AND field_key = ? AND target_id = ?)
   * - isNull: NOT EXISTS (...)  — no related records
   * - isNotNull: EXISTS (...)   — at least one related record
   * - contains: EXISTS (...AND target = value)
   */
  private buildRelationalFilterCondition(
    entityType: string,
    entityIdColumn: any,
    def: FieldDefinition,
    operator: string,
    value: unknown,
  ): any {
    if (def.fieldType === 'tags') {
      return this.buildTagFilterCondition(entityType, entityIdColumn, operator, value);
    }

    if (def.fieldType === 'multi_user' || def.fieldType === 'multi_lookup') {
      return this.buildMultiValueFilterCondition(entityType, entityIdColumn, def.fieldKey, operator, value);
    }

    return null;
  }

  private buildTagFilterCondition(
    entityType: string,
    entityIdColumn: any,
    operator: string,
    value: unknown,
  ): any {
    const baseWhere = sql`et.entity_type = ${entityType} AND et.entity_id = ${entityIdColumn} AND ${tenantCondition()}`;

    switch (operator) {
      case 'contains': {
        const tagId = String(value);
        return sql`EXISTS (SELECT 1 FROM entity_tags et WHERE ${baseWhere} AND et.tag_id = ${tagId})`;
      }
      case 'isNull':
        return sql`NOT EXISTS (SELECT 1 FROM entity_tags et WHERE ${baseWhere})`;
      case 'isNotNull':
        return sql`EXISTS (SELECT 1 FROM entity_tags et WHERE ${baseWhere})`;
      default:
        return null;
    }
  }

  private buildMultiValueFilterCondition(
    entityType: string,
    entityIdColumn: any,
    fieldKey: string,
    operator: string,
    value: unknown,
  ): any {
    const baseWhere = sql`emv.entity_type = ${entityType} AND emv.entity_id = ${entityIdColumn} AND emv.field_key = ${fieldKey} AND ${tenantCondition()}`;

    switch (operator) {
      case 'contains': {
        const targetId = String(value);
        return sql`EXISTS (SELECT 1 FROM entity_multi_values emv WHERE ${baseWhere} AND emv.target_id = ${targetId})`;
      }
      case 'isNull':
        return sql`NOT EXISTS (SELECT 1 FROM entity_multi_values emv WHERE ${baseWhere})`;
      case 'isNotNull':
        return sql`EXISTS (SELECT 1 FROM entity_multi_values emv WHERE ${baseWhere})`;
      default:
        return null;
    }
  }

  // ---------------------------------------------------------------------------
  // RELATIONAL FIELD HELPERS (tags, category, multi)
  // ---------------------------------------------------------------------------

  /**
   * After creating an entity, handle relational fields:
   * - tags: attach each tag ID via TaxonomyService
   * - category: stored as standard/EAV field (handled by splitPayload)
   */
  // handleRelationalCreate/Update and processFileFields have been replaced by
  // FieldTypeSaveHookRegistry lifecycle hooks (onBeforeSave, onTransactionalSave)

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
        const allTags = this.taxonomyExt ? await this.taxonomyExt.getTagsForEntity(this.config.entityType, entityId) : [];
        for (const field of tagFields) {
          const fieldTags = field.tagGroupSlug
            ? allTags.filter(t => t.groupSlug === field.tagGroupSlug)
            : allTags;
          row[field.fieldKey] = fieldTags.map(t => ({ id: t.id, name: t.name, color: t.color }));
        }
      }

      // Hydrate multi-value fields (multi_user, multi_lookup)
      if (multiFields.length > 0 && this.multiValueExtension) {
        const allMulti = await this.multiValueExtension.getAllMultiValues(this.config.entityType, entityId);
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
              .where(sql`id IN (${sql.join(targetIds.map(id => sql`${id}`), sql`, `)}) AND ${tenantCondition()}`);
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

    // Resolve category fields via categories table
    const categoryFields = defs.filter(
      (d: FieldDefinition) => d.fieldType === 'category',
    );

    if (lookupFields.length === 0 && userFields.length === 0 && categoryFields.length === 0) return;

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

    // Collect unique category IDs
    const categoryIds = new Set<string>();
    for (const field of categoryFields) {
      for (const row of rows) {
        const value = row[field.fieldKey];
        if (typeof value === 'string' && value.length > 0) {
          categoryIds.add(value);
        }
      }
    }

    // Batch resolve all lookup entities + users + categories in parallel
    const labelMaps = new Map<string, Map<string, string>>();
    const userLabelMap = new Map<string, string>();
    const categoryLabelMap = new Map<string, string>();

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
          .where(sql`id IN (${sql.join(Array.from(userIds).map(id => sql`${id}`), sql`, `)}) AND ${tenantCondition()}`)
          .then((users: any[]) => {
            for (const u of users) {
              userLabelMap.set(u.id, `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim());
            }
          }),
      );
    }

    if (categoryIds.size > 0) {
      resolvePromises.push(
        this.database.db
          .select({ id: sql`id`, name: sql`name` })
          .from(sql`categories`)
          .where(sql`id IN (${sql.join(Array.from(categoryIds).map(id => sql`${id}`), sql`, `)}) AND ${tenantCondition()}`)
          .then((cats: any[]) => {
            for (const c of cats) {
              categoryLabelMap.set(c.id, c.name);
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
      for (const field of categoryFields) {
        const value = row[field.fieldKey];
        if (typeof value === 'string' && categoryLabelMap.size > 0) {
          row[`${field.fieldKey}__label`] = categoryLabelMap.get(value) ?? null;
        }
      }
    }
  }

  /** Extract field-level data from a DB row, excluding infrastructure-only columns. */
  private rowToSnapshot(row: Record<string, unknown>): Record<string, unknown> {
    const infraCols = new Set(['id', 'createdAt', 'updatedAt', 'createdBy', 'deletedAt', 'deletedBy']);
    const snapshot: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (!infraCols.has(key)) {
        snapshot[key] = value;
      }
    }
    return snapshot;
  }

  /** Build a full snapshot (standard + EAV) for event payloads. */
  private async buildEntitySnapshot(row: Record<string, unknown>): Promise<Record<string, unknown>> {
    const eavValues = this.eavStorage
      ? await this.eavStorage.getValues(this.config.entityType, row.id as string)
      : {};
    return buildSnapshot(this.rowToSnapshot(row), eavValues);
  }

  /** Merge DB row + EAV values into API response. Custom hook can override. */
  private async toResponse(
    row: Record<string, unknown>,
    preloadedEavValues?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const eavValues = preloadedEavValues ?? (this.eavStorage ? await this.eavStorage.getValues(this.config.entityType, row.id as string) : {});

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

      const softDeleteCond = buildSoftDeleteCondition(table);
      if (softDeleteCond) conditions.push(softDeleteCond);

      const [existing] = await this.database.db
        .select({ id: table.id })
        .from(table)
        .where(withTenant(table, ...conditions))
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
    if (!this.eavStorage) return; // Skip EAV uniqueness checks when EAV is not loaded

    const uniqueEavDefs = defs.filter((d: any) => d.isUnique && !d.columnName && fields[d.fieldKey] != null);

    for (const def of uniqueEavDefs) {
      const isUnique = await this.eavStorage.checkUniqueness(
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
