import crypto from 'crypto';
import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { eq, and, or, isNull, ilike, asc, desc, count, sql, getTableName, getTableColumns } from 'drizzle-orm';
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
import { fieldTypeRegistry, type FieldTypeSaveContext } from '@packages/field-types';
import { DatabaseService, type DrizzleTx } from '@packages/database';
import { ScopeResolverRegistry, type ScopeAnchorMap } from '@packages/rbac';
import { DomainEventEmitter } from '@packages/events';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { FieldDefinitionService } from './services/field-definition.service';
import { LookupResolverService } from './services/lookup-resolver.service';
import type { EavStorageExtension } from './extensions/eav-storage.interface';
import type { MultiValueExtension } from './extensions/multi-value-extension.interface';
import type { FieldDefinition, FieldType } from './types';
import { buildSnapshot, diffSnapshot } from './helpers/snapshot';
import { validatePayload } from './helpers/validate-payload';
import { splitPayload } from './helpers/split-payload';
import { splitExtensionPayload } from './helpers/split-extension-payload';
import { buildClonePayload } from './helpers/build-clone-payload';
import { infrastructureSelectKeys } from './helpers/infrastructure-select-keys';
import type { WorkflowExtension } from './extensions/workflow-extension.interface';
import type { TaxonomyExtension } from './extensions/taxonomy-extension.interface';
import type { PaginatedResponse } from '@packages/common';
import type { EntityConfig, BaseListQuery, ListLayoutColumn, TransitionContext } from './types';
import type { DataAccessContext, AccessScopeSpec } from '@packages/rbac';
import type { SQL as DrizzleSQL } from 'drizzle-orm';
import { EntityRegistryService } from './entity-registry.service';

/** Map custom-field types to the SQL cast used when sorting a JSONB custom field. */
function jsonbSortCast(fieldType: FieldType): string | null {
  switch (fieldType) {
    case 'number':
    case 'currency':
    case 'decimal':
      return 'numeric';
    case 'date':
      return 'date';
    case 'datetime':
      return 'timestamptz';
    case 'boolean':
      return 'boolean';
    default:
      return null;
  }
}

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
    private readonly workflowExt: WorkflowExtension | null,
    private readonly entityRegistry: EntityRegistryService,
    appLogger: AppLoggerService,
    private readonly scopeResolverRegistry: ScopeResolverRegistry,
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
   * Field definitions visible to this entity. For extension entities, this
   * surfaces the child's own field defs plus the parent's field defs for any
   * projected column, so validation and payload-splitting recognise writes to
   * parent-owned fields as legitimate. The child's own defs take precedence
   * if a key happens to exist on both sides.
   */
  private getEffectiveFieldDefs() {
    const ownDefs = this.fieldDefinitionService.listByEntityWithOptions(this.config.entityType);
    const ext = this.getExtensionMeta();
    if (!ext) return ownDefs;

    const ownKeys = new Set(ownDefs.map((d) => d.fieldKey));
    const parentDefs = this.fieldDefinitionService.listByEntityWithOptions(ext.parentEntityType);
    const projectedKeys = new Set(ext.projectedColumns.map((c) => c.fieldKey));
    const extras = parentDefs.filter((d) => projectedKeys.has(d.fieldKey) && !ownKeys.has(d.fieldKey));
    return [...ownDefs, ...extras];
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
   * Resolves a set of access scopes into a single SQL WHERE condition by
   * OR-ing the predicate produced by each scope.
   *
   * Every scope is dispatched in the same way:
   *   1. Look up the scope type in the global `ScopeResolverRegistry`.
   *   2. If not found, fall back to an entity-local resolver declared in
   *      `dataAccess.scopes[]` (used for scope kinds whose SQL can't be
   *      expressed through the generic anchor map).
   *
   * `any` is the only scope the engine itself understands — it short-circuits
   * to "no filter." Every other scope type lands as a registered resolver,
   * so adding a new scope kind does not require a platform edit.
   *
   * If the scope array is empty (user holds no scopes for this verb), the
   * result is a `1=0` condition that matches no rows — i.e. no access.
   */
  private async resolveDataAccessScope(ctx: DataAccessContext): Promise<DrizzleSQL | undefined> {
    if (ctx.scopes.length === 0) {
      // No scopes held → deny. Use a contradiction so callers compose with AND safely.
      return sql`1=0`;
    }

    // `any` is the most permissive scope — wins over every other scope in the array.
    if (ctx.scopes.some((s) => s.type === 'any')) return undefined;

    const anchors = this.buildAnchors();
    const predicates: DrizzleSQL[] = [];

    for (const scope of ctx.scopes) {
      const predicate = await this.resolveScope(scope, ctx.userId, anchors);
      if (predicate) predicates.push(predicate);
    }

    if (predicates.length === 0) return sql`1=0`;
    if (predicates.length === 1) return predicates[0];
    return or(...predicates)!;
  }

  /**
   * Resolve one scope to a predicate — registry first, then entity-inline
   * resolvers, otherwise a warning + no-op. Warn (rather than throw) so a
   * stale scope sitting on an old role grant degrades gracefully.
   */
  private async resolveScope(
    scope: AccessScopeSpec,
    userId: string,
    anchors: ScopeAnchorMap,
  ): Promise<DrizzleSQL | undefined> {
    const registered = this.scopeResolverRegistry.get(scope.type);
    if (registered) {
      const result = await registered.resolve({ userId, anchors }, scope.params);
      return result ?? undefined;
    }

    const inline = this.config.dataAccess?.scopes?.find((s) => s.key === scope.type);
    if (inline) return inline.resolve(userId);

    this.logger.warn(`Unknown data access scope type: ${scope.type}`);
    return undefined;
  }

  /**
   * Build the semantic anchor map for this entity from `dataAccess.anchors`.
   * Each entry maps a role ('creator', 'assignee', 'team', ...) to the
   * corresponding Drizzle column. Anchors referencing non-existent columns
   * are dropped (defence-in-depth against config typos).
   */
  private buildAnchors(): ScopeAnchorMap {
    const table = this.config.table as unknown as Record<string, PgColumn | undefined>;
    const declared = this.config.dataAccess?.anchors ?? {};
    const anchors: ScopeAnchorMap = {};
    for (const [role, columnName] of Object.entries(declared)) {
      const col = table[columnName];
      if (col) anchors[role] = col;
    }
    return anchors;
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

    // Hierarchy/orderable columns are infrastructure — not registered as
    // user-editable fields, but list consumers (tree renderers, drag-drop
    // UIs) need them to decide parent/child relationships and nesting depth.
    // Include them unconditionally when the entity opts in.
    for (const key of infrastructureSelectKeys(this.config)) {
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
        sortable:
          !!config.sortableColumns[d.fieldKey]
          || (config.customFields === true && !d.columnName && !fieldTypeRegistry.isRelational(d.fieldType)),
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

    const whereClause = conditions.length > 0
      ? withTenant(scopeTable, and(...conditions))
      : withTenant(scopeTable);

    // Sort — check if the sort key is a lookup field, use label subquery if so
    const sortKey = query.sort ?? config.defaultSort;
    const orderDirection = query.order === 'asc' ? 'ASC' : 'DESC';
    const orderByExpr = this.buildSortExpression(sortKey, orderDirection, config);

    // Stable tiebreak on id when sorting by sort_order on an orderable entity.
    // Without this, two rows sharing a sort_order would return in DB-dependent
    // order and drag-drop UIs would flicker. Kept outside buildSortExpression
    // because it applies only to list reads — single-column sorts elsewhere
    // (exports, snapshots) don't need paginated stability.
    const orderByClauses = (config.orderable && sortKey === 'sortOrder')
      ? [orderByExpr, asc((config.table as any).id)]
      : [orderByExpr];

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
      .orderBy(...orderByClauses)
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

  /**
   * Read the joined child+parent row for an extension entity inside a given
   * transaction. Used by the write path to capture consistent before/after
   * snapshots across the two tables. Mirrors findOneOrFail's selectMap
   * construction so both paths return the same shape.
   *
   * Bypasses soft-delete + scope filtering — callers in the write path have
   * already verified visibility via findOneOrFail.
   */
  private async readJoinedRowInTx(
    tx: any,
    id: string,
    ext: import('./types').ResolvedExtension,
  ): Promise<Record<string, unknown>> {
    const selectMap: Record<string, any> = this.buildListSelectMap([], ext);
    for (const [k, col] of Object.entries(getTableColumns(this.config.table as any))) {
      if (!(k in selectMap)) selectMap[k] = col as PgColumn;
    }
    const [row] = await tx
      .select(selectMap)
      .from(this.config.table as any)
      .innerJoin(ext.parentTable as any, eq(ext.parentIdColumn, ext.foreignKeyColumn))
      .where(eq(ext.foreignKeyColumn, id))
      .limit(1) as any[];
    return row;
  }

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------

  async create(payload: Record<string, unknown>, actorId: string, externalTx?: DrizzleTx): Promise<Record<string, unknown>> {
    const { config } = this;
    const data = { ...payload };

    // Load field definitions — for extensions this includes the child's own
    // defs plus the parent's defs for every projected column, so a write to a
    // parent-owned field validates and splits correctly instead of being
    // silently dropped as an unknown key.
    const defs = this.getEffectiveFieldDefs();

    // Validate
    const result = validatePayload(defs, data, { partial: false }, config.relationships ?? []);
    if (!result.valid) {
      throw new BadRequestException({ message: 'Validation failed', errors: result.errors });
    }

    // Split standard vs custom vs relational vs relationship inputs
    const { standardFields, customFields, relationalFields, relationshipInputs } = splitPayload(defs, data, config.relationships ?? []);

    // Email normalization (if email field exists)
    if (standardFields.email && typeof standardFields.email === 'string') {
      standardFields.email = standardFields.email.toLowerCase();
    }

    // Check uniqueness for standard unique columns
    await this.checkStandardUniqueness(defs, standardFields);

    // Check uniqueness for custom EAV unique fields
    await this.checkEavUniqueness(defs, customFields);

    // Pre-generate entity ID so transformValueBeforeSave can use it (e.g. file paths)
    const entityId = crypto.randomUUID();

    // Phase 1: transformValueBeforeSave (pre-transaction, can throw to abort)
    const allFields = { ...customFields, ...relationalFields };
    const defMap = new Map(defs.map(d => [d.fieldKey, d]));
    for (const [key, value] of Object.entries(allFields)) {
      const def = defMap.get(key);
      const ft = def && fieldTypeRegistry.get(def.fieldType);
      if (!ft?.transformValueBeforeSave) continue;
      const ctx: FieldTypeSaveContext = {
        entityType: config.entityType, entityId, fieldKey: key, mode: 'create', actorId,
      };
      const next = await ft.transformValueBeforeSave(value, ctx);
      if (key in customFields) customFields[key] = next;
      if (key in relationalFields) relationalFields[key] = next;
    }

    // Phase 2: Transaction (entity row + EAV + relational writes).
    // Extension entities (`extensionOf`) insert the parent row first, then the
    // child using the same `entityId` as its FK-also-PK. Both in one tx so a
    // failure on either side rolls back cleanly.
    // If `externalTx` is passed, reuse it so caller-side composition (tags, multi-value
    // writes done by per-entity services) commits atomically with the entity row.
    const ext = this.getExtensionMeta();
    const createTxBody = async (tx: DrizzleTx) => {
      let inserted: any;

      if (ext) {
        const { parentFields, childFields } = splitExtensionPayload(standardFields, ext);

        const parentTableCols = getTableColumns(ext.parentTable as any);
        const parentRecord: Record<string, unknown> = {
          id: entityId,
          ...ext.parentDefaults,
          ...parentFields,
        };
        if ('createdBy' in parentTableCols) parentRecord.createdBy = actorId;
        await tx
          .insert(ext.parentTable as any)
          .values(withTenantInsert(ext.parentTable as any, parentRecord) as any);

        const childTableCols = getTableColumns(config.table as any);
        const childRecord: Record<string, unknown> = {
          [ext.foreignKeyField]: entityId,
          ...childFields,
        };
        if ('createdBy' in childTableCols) childRecord.createdBy = actorId;
        const childResult = await tx
          .insert(config.table as any)
          .values(withTenantInsert(config.table as any, childRecord) as any)
          .returning() as any[];
        inserted = childResult[0];
      } else {
        const result = await tx
          .insert(config.table as any)
          .values(withTenantInsert(config.table as any, { id: entityId, ...standardFields, createdBy: actorId }) as any)
          .returning() as any[];
        inserted = result[0];
      }

      if (Object.keys(customFields).length > 0 && this.eavStorage) {
        await this.eavStorage.setValues(config.entityType, entityId, customFields, tx);
      }

      return inserted;
    };

    let row = externalTx
      ? await createTxBody(externalTx)
      : await this.database.db.transaction(createTxBody);

    // For extension entities the child row on its own is only half the entity.
    // Re-read via the joined findOneOrFail so snapshot/event/response see the
    // full shape (id aliased + projected parent columns included).
    if (ext) {
      row = await this.findOneOrFail(entityId);
    }

    // Phase 3: onAfterSave (fire-and-forget)
    for (const [key, value] of Object.entries(allFields)) {
      const def = defMap.get(key);
      const ft = def && fieldTypeRegistry.get(def.fieldType);
      if (!ft?.onAfterSave) continue;
      const ctx: FieldTypeSaveContext = {
        entityType: config.entityType, entityId: row.id, fieldKey: key, mode: 'create', actorId,
      };
      ft.onAfterSave(value, ctx).catch(err =>
        this.logger.warn(`onAfterSave failed for ${def!.fieldType}/${key}: ${err}`),
      );
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

    // Emit event (with resolved lookup labels for audit readability)
    const snapshot = await this.buildEntitySnapshot(row);
    await this.resolveLookupLabels([snapshot]);
    this.domainEventEmitter.emitDynamic(`${config.entityType}.Created`, {
      entityType: config.entityType,
      entityId: row.id,
      actorId,
      payload: { after: snapshot },
    });

    // For extensions, `row` was re-read via findOneOrFail above and is
    // already in response shape; skip the second toResponse pass.
    return ext ? row : this.toResponse(row);
  }

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------

  async update(id: string, payload: Record<string, unknown>, actorId: string, accessCtx?: DataAccessContext, externalTx?: DrizzleTx): Promise<Record<string, unknown>> {
    const { config } = this;
    const table = config.table as any;

    // Ensure entity exists and is within the actor's scope
    await this.findOneOrFail(id, accessCtx);

    const data = { ...payload };

    // Load effective field definitions (own + projected parent for extensions)
    const defs = this.getEffectiveFieldDefs();

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
    const result = validatePayload(defs, data, { partial: true }, config.relationships ?? []);
    if (!result.valid) {
      throw new BadRequestException({ message: 'Validation failed', errors: result.errors });
    }

    // Split
    const { standardFields, customFields, relationalFields, relationshipInputs } = splitPayload(defs, data, config.relationships ?? []);

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
    const hasRelationshipInputs = Object.keys(relationshipInputs).length > 0;

    if (!hasStandardChanges && !hasCustomChanges && !hasRelationalChanges && !hasRelationshipInputs) {
      return this.findOneOrFail(id);
    }

    // Check uniqueness
    await this.checkStandardUniqueness(defs, updateValues, id);
    await this.checkEavUniqueness(defs, customFields, id);

    // Phase 1: transformValueBeforeSave (pre-transaction, can throw to abort)
    const allUpdateFields = { ...customFields, ...relationalFields };
    const updateDefMap = new Map(defs.map(d => [d.fieldKey, d]));
    for (const [key, value] of Object.entries(allUpdateFields)) {
      const def = updateDefMap.get(key);
      const ft = def && fieldTypeRegistry.get(def.fieldType);
      if (!ft?.transformValueBeforeSave) continue;
      const ctx: FieldTypeSaveContext = {
        entityType: config.entityType, entityId: id, fieldKey: key, mode: 'update', actorId,
      };
      const next = await ft.transformValueBeforeSave(value, ctx);
      if (key in customFields) customFields[key] = next;
      if (key in relationalFields) relationalFields[key] = next;
    }

    let eventPayload: { changes: string[]; before: Record<string, unknown>; after: Record<string, unknown> } | null = null;

    // Phase 2: Transaction (entity row + EAV + relational writes).
    // If `externalTx` is passed, reuse it so caller-side composition commits atomically.
    const ext = this.getExtensionMeta();
    const updateTxBody = async (tx: DrizzleTx) => {
      // Read before snapshot inside tx for consistency. For extensions the
      // child row alone is only half the entity — read the joined shape so
      // the snapshot includes projected parent columns.
      const eavBefore = this.eavStorage ? await this.eavStorage.getValues(config.entityType, id, tx) : {};
      const existingRow = ext
        ? await this.readJoinedRowInTx(tx, id, ext)
        : (await tx.select().from(table).where(withTenant(table, eq(table.id, id))).limit(1) as any[])[0];
      const before = buildSnapshot(this.rowToSnapshot(existingRow), eavBefore);

      // Update standard columns. Extensions split the bucket into parent and
      // child slices; either side can be empty. When only the parent slice
      // has changes, the child row still gets an updatedAt bump (if the column
      // exists) so the extension entity's audit trail stays current.
      let row = existingRow;
      if (hasStandardChanges) {
        if (ext) {
          const { parentFields, childFields } = splitExtensionPayload(updateValues, ext);
          const hasParentChanges = Object.keys(parentFields).length > 0;
          const hasChildChanges = Object.keys(childFields).length > 0;

          if (hasParentChanges) {
            await tx
              .update(ext.parentTable as any)
              .set(parentFields)
              .where(withTenant(ext.parentTable as any, eq(ext.parentIdColumn, id)));
          }

          if (hasChildChanges) {
            await tx
              .update(config.table as any)
              .set(childFields)
              .where(withTenant(config.table as any, eq(ext.foreignKeyColumn, id)));
          } else if (hasParentChanges) {
            const childCols = getTableColumns(config.table as any);
            if ('updatedAt' in childCols) {
              await tx
                .update(config.table as any)
                .set({ updatedAt: new Date() } as any)
                .where(withTenant(config.table as any, eq(ext.foreignKeyColumn, id)));
            }
          }

          row = await this.readJoinedRowInTx(tx, id, ext);
        } else {
          const [updatedRow] = await tx
            .update(table)
            .set(updateValues)
            .where(withTenant(table, eq(table.id, id)))
            .returning() as any[];
          row = updatedRow;
        }
      }

      // Update EAV values
      let eavAfter = eavBefore;
      if (hasCustomChanges && this.eavStorage) {
        const eavResult = await this.eavStorage.setValues(config.entityType, id, customFields, tx);
        eavAfter = eavResult.after;
      }

      const after = buildSnapshot(this.rowToSnapshot(row), eavAfter);
      const changes = diffSnapshot(before, after);

      if (changes.length > 0) {
        eventPayload = { changes, before, after };
      }

      return row;
    };

    const updated = externalTx
      ? await updateTxBody(externalTx)
      : await this.database.db.transaction(updateTxBody);

    // Phase 3: onAfterSave (fire-and-forget)
    for (const [key, value] of Object.entries(allUpdateFields)) {
      const def = updateDefMap.get(key);
      const ft = def && fieldTypeRegistry.get(def.fieldType);
      if (!ft?.onAfterSave) continue;
      const ctx: FieldTypeSaveContext = {
        entityType: config.entityType, entityId: id, fieldKey: key, mode: 'update', actorId,
      };
      ft.onAfterSave(value, ctx).catch(err =>
        this.logger.warn(`onAfterSave failed for ${def!.fieldType}/${key}: ${err}`),
      );
    }

    this.logger.log(`${config.singularName} updated`, { entityId: id, actorId });

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

  /**
   * Split into three primitives (`validateTransition` → `applyTransition` →
   * `emitTransitionEvent`) so domain services can compose atomic cascades
   * inside the same transaction as the engine's status update + history
   * write. The thin `transition()` bundler below is what entities without a
   * cascade continue to use — it's one line of orchestration delegating to
   * all three. Entities that need transactional side effects open their own
   * tx, call `applyTransition(validated, tx)`, run their cascade on the same
   * tx, then emit after commit via `emitTransitionEvent`.
   *
   * Don't skip `validateTransition`: permission checks, guard evaluation,
   * reason/comment requirements, and workflow lookup all happen there.
   * Bypassing it means bypassing RBAC.
   */
  async transition(
    id: string,
    fieldKey: string,
    toState: string,
    actorId: string,
    options?: { reason?: string; comment?: string },
    accessCtx?: DataAccessContext,
  ): Promise<Record<string, unknown>> {
    const validated = await this.validateTransition(id, fieldKey, toState, actorId, options, accessCtx);
    await this.database.db.transaction(async (tx) => {
      await this.applyTransition(validated, tx);
    });
    this.emitTransitionEvent(validated);
    return this.findOneOrFail(id);
  }

  /**
   * Phase 1 of a transition: everything up to (but not including) the tx.
   * Loads the entity (scope-checked), resolves the workflow assignment,
   * validates the transition (permissions, guards, conditions), and enforces
   * reason/comment constraints. Throws on any failure. Returns a frozen
   * `TransitionContext` that downstream phases consume — never compute
   * fromState/toState again from the entity, they might not match.
   */
  async validateTransition(
    id: string,
    fieldKey: string,
    toState: string,
    actorId: string,
    options?: { reason?: string; comment?: string },
    accessCtx?: DataAccessContext,
  ): Promise<TransitionContext> {
    const { config } = this;
    const reason = options?.reason;
    const comment = options?.comment;

    const entity = await this.findOneOrFail(id, accessCtx);

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

    const validated = await this.workflowExt.validateAndThrow({
      workflowSlug: workflow.slug,
      entityType: config.entityType,
      entityId: id,
      fromState: currentState,
      toState,
      actorId,
      entityData: entity as Record<string, unknown>,
    });

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

    return {
      entityType: config.entityType,
      entityId: id,
      fieldKey,
      fieldName: validated.fieldName,
      fromState: currentState,
      toState,
      transitionId: validated.transitionId,
      transitionName: validated.transitionName,
      workflowDefinitionId: validated.workflowDefinitionId,
      workflowSlug: workflow.slug,
      actorId,
      reason,
      comment,
      entity: entity as Record<string, unknown>,
    };
  }

  /**
   * Phase 2 of a transition: runs inside the caller-supplied tx. Updates the
   * entity's workflow field and records workflow history on the same tx.
   * Throwing rolls the whole transition back — the calling domain service
   * can piggyback additional cascades on this tx and get the same atomicity.
   */
  async applyTransition(validated: TransitionContext, tx: any): Promise<void> {
    const { config } = this;
    const table = config.table as any;
    const col = table[validated.fieldKey];
    if (col) {
      await tx
        .update(table)
        .set({ [validated.fieldKey]: validated.toState })
        .where(withTenant(table, eq(table.id, validated.entityId)));
    } else if (this.eavStorage) {
      await this.eavStorage.setValues(
        config.entityType,
        validated.entityId,
        { [validated.fieldKey]: validated.toState },
        tx,
      );
    }

    await this.workflowExt!.recordHistory({
      workflowDefinitionId: validated.workflowDefinitionId,
      entityType: config.entityType,
      entityId: validated.entityId,
      fieldName: validated.fieldName,
      fromState: validated.fromState,
      toState: validated.toState,
      transitionId: validated.transitionId,
      actorId: validated.actorId,
      reason: validated.reason,
      comment: validated.comment,
    }, tx);
  }

  /**
   * Phase 3 of a transition: emit the post-commit dynamic event
   * (`{entityType}.{Field}Changed`). Must run AFTER the tx commits — handlers
   * assume the state change is durable. Callers that own the tx are
   * responsible for invoking this after `db.transaction(...)` resolves.
   */
  emitTransitionEvent(validated: TransitionContext): void {
    const { config } = this;
    this.logger.log(`${config.singularName} transitioned`, {
      entityId: validated.entityId,
      fieldKey: validated.fieldKey,
      from: validated.fromState,
      to: validated.toState,
      actorId: validated.actorId,
    });

    const pascalField = validated.fieldKey.charAt(0).toUpperCase() + validated.fieldKey.slice(1);
    this.domainEventEmitter.emitDynamic(`${config.entityType}.${pascalField}Changed`, {
      entityType: config.entityType,
      entityId: validated.entityId,
      actorId: validated.actorId,
      payload: {
        workflowSlug: validated.workflowSlug,
        fieldName: validated.fieldName,
        fromState: validated.fromState,
        toState: validated.toState,
        transitionId: validated.transitionId,
        transitionName: validated.transitionName,
        reason: validated.reason,
        comment: validated.comment,
      },
    });
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

  async softDelete(id: string, actorId: string, accessCtx?: DataAccessContext, externalTx?: DrizzleTx): Promise<void> {
    const { config } = this;
    const entity = await this.findOneOrFail(id, accessCtx);

    // Extensions scope reads through the parent's deletedAt — the child
    // usually has no deletedAt of its own. Soft-delete therefore flips the
    // parent's columns; the child row is left as-is so a restore is a clean
    // reverse.
    const exec = externalTx ?? this.database.db;
    const ext = this.getExtensionMeta();
    if (ext) {
      await exec
        .update(ext.parentTable as any)
        .set({ deletedAt: new Date(), deletedBy: actorId } as any)
        .where(withTenant(ext.parentTable as any, eq(ext.parentIdColumn, id)));
    } else {
      await exec
        .update(config.table as any)
        .set({ deletedAt: new Date(), deletedBy: actorId } as any)
        .where(withTenant(config.table as any, eq((config.table as any).id, id)));
    }

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

    // Extensions: check the child row exists (may not have deletedAt of its
    // own) and flip the parent's deletedAt columns back to null — the mirror
    // of softDelete above. Return the joined response so the restored entity
    // is indistinguishable from a fresh read.
    const ext = this.getExtensionMeta();
    if (ext) {
      const [childRow] = await this.database.db
        .select()
        .from(table)
        .where(eq(ext.foreignKeyColumn, id))
        .limit(1) as any[];

      if (!childRow) {
        throw new NotFoundException(`${config.singularName} not found`);
      }

      await this.database.db
        .update(ext.parentTable as any)
        .set({ deletedAt: null, deletedBy: null } as any)
        .where(withTenant(ext.parentTable as any, eq(ext.parentIdColumn, id)));

      this.logger.log(`${config.singularName} restored`, { entityId: id });
      return this.findOneOrFail(id);
    }

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

    // JSONB custom field sort: resolve via the field definition cache so every
    // defined custom field becomes sortable without additional configuration.
    if (config.customFields === true) {
      const def = this.fieldDefinitionService.findByEntityAndKey(config.entityType, sortKey);
      if (def && !def.columnName && !fieldTypeRegistry.isRelational(def.fieldType)) {
        const table = config.table as any;
        const cast = jsonbSortCast(def.fieldType);
        const textExpr = sql`${table.customFields} ->> ${sortKey}`;
        const expr = cast ? sql`(${textExpr})::${sql.raw(cast)}` : textExpr;
        return sql`${expr} ${sql.raw(direction)} NULLS LAST`;
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
   * Resolves standard DB columns via query-builder, routes custom-field filters
   * (JSONB or EAV) to the configured storage adapter. For extension entities,
   * projected parent columns are added to the column map so a filter like
   * `?status=open` routes to `parent.status`.
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

    // Classify unresolved filters into custom-field vs relational
    const defsByKey = new Map(defs.map((d) => [d.fieldKey, d]));
    const customFieldFilters: { fieldKey: string; operator: any; value: any }[] = [];

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
        // Custom field: route to the configured storage adapter (JSONB or EAV)
        customFieldFilters.push({ fieldKey: f.field, operator: f.operator, value: f.value });
      }
    }

    if (customFieldFilters.length > 0 && this.eavStorage) {
      const condition = this.eavStorage.buildFilterCondition(
        config.entityType,
        table.id,
        customFieldFilters,
      );
      conditions.push(condition);
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

  /** Merge DB row + EAV values into API response. */
  private async toResponse(
    row: Record<string, unknown>,
    preloadedEavValues?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const eavValues = preloadedEavValues ?? (this.eavStorage ? await this.eavStorage.getValues(this.config.entityType, row.id as string) : {});

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
