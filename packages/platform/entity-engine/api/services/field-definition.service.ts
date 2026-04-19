import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException, type OnApplicationBootstrap } from '@nestjs/common';
import { DatabaseService, eq } from '@packages/database';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import { fieldDefinitions } from '../schema/field-definitions';
import { picklistOptions } from '../schema/picklist-options';
import type { FieldDefinition, PicklistOption, FieldType, FullLayoutField, RegisterFieldInput, SetPicklistOptionInput } from '../types';

type DeleteCheck = (entityType: string, fieldKey: string) => Promise<void>;

@Injectable()
export class FieldDefinitionService implements OnApplicationBootstrap {
  private readonly logger = new Logger(FieldDefinitionService.name);
  private deleteChecks: DeleteCheck[] = [];

  // Cache populated once in onApplicationBootstrap and kept in sync on every
  // write. Reads serve exclusively from these maps; direct DB reads happen
  // only inside reloadCache().
  private fieldsByEntity = new Map<string, FieldDefinition[]>();
  private fieldsById = new Map<string, FieldDefinition>();
  private picklistByField = new Map<string, PicklistOption[]>();
  private ready = false;

  constructor(private readonly database: DatabaseService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.reloadCache();
  }

  /**
   * Full reload from DB. Called once at bootstrap; exposed for tests and for
   * operational recovery when a process hasn't seen a cache-affecting write
   * made by another instance.
   */
  async reloadCache(): Promise<void> {
    const allFields = await this.database.db
      .select()
      .from(fieldDefinitions)
      .orderBy(fieldDefinitions.sortOrder);

    const allOptions = await this.database.db
      .select()
      .from(picklistOptions)
      .orderBy(picklistOptions.sortOrder);

    this.fieldsByEntity.clear();
    this.fieldsById.clear();
    this.picklistByField.clear();

    for (const row of allFields as FieldDefinition[]) {
      const bucket = this.fieldsByEntity.get(row.entityType);
      if (bucket) bucket.push(row);
      else this.fieldsByEntity.set(row.entityType, [row]);
      this.fieldsById.set(row.id, row);
    }

    for (const opt of allOptions as PicklistOption[]) {
      const bucket = this.picklistByField.get(opt.fieldId);
      if (bucket) bucket.push(opt);
      else this.picklistByField.set(opt.fieldId, [opt]);
    }

    this.ready = true;
    this.logger.log(
      `Loaded ${allFields.length} field definitions and ${allOptions.length} picklist options into cache`,
    );
  }

  /**
   * Register a callback invoked before deleting a custom field.
   * Extensions (e.g., EAV) use this to check for existing values.
   */
  registerDeleteCheck(check: DeleteCheck): void {
    this.deleteChecks.push(check);
  }

  // ---------------------------------------------------------------------------
  // Reads — all served from cache
  // ---------------------------------------------------------------------------

  findById(id: string): FieldDefinition | null {
    return this.fieldsById.get(id) ?? null;
  }

  findByEntityAndKey(entityType: string, fieldKey: string): FieldDefinition | null {
    const bucket = this.fieldsByEntity.get(entityType);
    if (!bucket) return null;
    return bucket.find((f) => f.fieldKey === fieldKey) ?? null;
  }

  findByEntityAndColumn(entityType: string, columnName: string): FieldDefinition | null {
    const bucket = this.fieldsByEntity.get(entityType);
    if (!bucket) return null;
    return bucket.find((f) => f.columnName === columnName) ?? null;
  }

  listByEntity(entityType: string): FieldDefinition[] {
    return this.fieldsByEntity.get(entityType) ?? [];
  }

  /**
   * List all field definitions for an entity with picklist options attached.
   * Used by payload validation to check picklist membership.
   */
  listByEntityWithOptions(entityType: string): FullLayoutField[] {
    const fields = this.listByEntity(entityType);
    return fields.map((f) => ({
      ...f,
      picklistOptions: this.picklistByField.get(f.id) ?? [],
      columnIndex: 0,
    }));
  }

  getPicklistOptions(fieldId: string): PicklistOption[] {
    return this.picklistByField.get(fieldId) ?? [];
  }

  // ---------------------------------------------------------------------------
  // Writes — DB first, cache in-place after
  // ---------------------------------------------------------------------------

  async create(entityType: string, data: {
    fieldKey: string;
    label: string;
    fieldType: FieldType;
    uiType?: string;
    isRequired?: boolean;
    isUnique?: boolean;
    isQuickCreate?: boolean;
    isReadonly?: boolean;
    maxLength?: number;
    defaultValue?: string;
    lookupEntity?: string;
    lookupLabelField?: string;
    lookupSearchFields?: string[];
    tagGroupSlug?: string;
    categoryGroupSlug?: string;
    fileAccept?: string[];
    fileMaxSize?: number;
  }): Promise<FieldDefinition> {
    const existing = this.findByEntityAndKey(entityType, data.fieldKey);
    if (existing) {
      if (!existing.isCustom) {
        throw new ConflictException(
          `Cannot create custom field '${data.fieldKey}' — it conflicts with a standard field on '${entityType}'`,
        );
      }
      throw new ConflictException(
        `Custom field '${data.fieldKey}' already exists for '${entityType}'`,
      );
    }

    const [field] = await this.database.db
      .insert(fieldDefinitions)
      .values(withTenantInsert(fieldDefinitions, {
        entityType,
        fieldKey: data.fieldKey,
        label: data.label,
        fieldType: data.fieldType,
        uiType: data.uiType ?? null,
        isRequired: data.isRequired ?? false,
        isSystem: false,
        isCustom: true,
        isUnique: data.isUnique ?? false,
        isQuickCreate: data.isQuickCreate ?? false,
        isReadonly: data.isReadonly ?? false,
        maxLength: data.maxLength ?? null,
        defaultValue: data.defaultValue ?? null,
        columnName: null, // Custom fields always use EAV
        lookupEntity: data.lookupEntity ?? null,
        lookupLabelField: data.lookupLabelField ?? null,
        lookupSearchFields: data.lookupSearchFields ?? null,
        tagGroupSlug: data.tagGroupSlug ?? null,
        categoryGroupSlug: data.categoryGroupSlug ?? null,
        fileAccept: data.fileAccept ?? null,
        fileMaxSize: data.fileMaxSize ?? null,
      }))
      .returning();

    const row = field as FieldDefinition;
    this.insertIntoCache(row);
    return row;
  }

  async update(id: string, data: {
    label?: string;
    isRequired?: boolean;
    isUnique?: boolean;
    isQuickCreate?: boolean;
    isReadonly?: boolean;
    maxLength?: number;
    defaultValue?: string;
    uiType?: string;
    sortOrder?: number;
  }): Promise<FieldDefinition> {
    const existing = this.findById(id);
    if (!existing) throw new NotFoundException('Field not found');

    const updateValues: Record<string, unknown> = {};
    if (data.label !== undefined) updateValues.label = data.label;
    if (data.isRequired !== undefined) updateValues.isRequired = data.isRequired;
    if (data.isUnique !== undefined) updateValues.isUnique = data.isUnique;
    if (data.isQuickCreate !== undefined) updateValues.isQuickCreate = data.isQuickCreate;
    if (data.isReadonly !== undefined) updateValues.isReadonly = data.isReadonly;
    if (data.maxLength !== undefined) updateValues.maxLength = data.maxLength;
    if (data.defaultValue !== undefined) updateValues.defaultValue = data.defaultValue;
    if (data.uiType !== undefined) updateValues.uiType = data.uiType;
    if (data.sortOrder !== undefined) updateValues.sortOrder = data.sortOrder;

    if (Object.keys(updateValues).length === 0) return existing;

    const [updated] = await this.database.db
      .update(fieldDefinitions)
      .set(updateValues)
      .where(withTenant(fieldDefinitions, eq(fieldDefinitions.id, id)))
      .returning();

    const row = updated as FieldDefinition;
    this.replaceInCache(row);
    return row;
  }

  async delete(id: string): Promise<void> {
    const field = this.findById(id);
    if (!field) throw new NotFoundException('Field not found');
    if (!field.isCustom) throw new BadRequestException('Cannot delete system or standard fields');

    // Run registered delete checks (e.g., EAV checks for existing values)
    for (const check of this.deleteChecks) {
      await check(field.entityType, field.fieldKey);
    }

    await this.database.db
      .delete(fieldDefinitions)
      .where(withTenant(fieldDefinitions, eq(fieldDefinitions.id, id)));

    this.removeFromCache(field);
  }

  async setPicklistOptions(
    entityType: string,
    fieldKey: string,
    options: SetPicklistOptionInput[],
  ): Promise<void> {
    const field = this.findByEntityAndKey(entityType, fieldKey);
    if (!field) throw new NotFoundException(`Field '${fieldKey}' not found for entity '${entityType}'`);

    if (field.fieldType !== 'picklist' && field.fieldType !== 'multi_select') {
      throw new BadRequestException('Picklist options can only be set on picklist or multi_select fields');
    }

    // Delete existing options and re-insert
    await this.database.db
      .delete(picklistOptions)
      .where(withTenant(picklistOptions, eq(picklistOptions.fieldId, field.id)));

    let inserted: PicklistOption[] = [];
    if (options.length > 0) {
      const rows = await this.database.db
        .insert(picklistOptions)
        .values(withTenantInsert(picklistOptions, options.map((opt, idx) => ({
          fieldId: field.id,
          label: opt.label,
          value: opt.value,
          isDefault: opt.isDefault ?? false,
          sortOrder: idx,
        }))))
        .returning();
      inserted = rows as PicklistOption[];
    }

    this.picklistByField.set(field.id, inserted);
  }

  /**
   * Idempotent registration of standard fields for a module.
   * Called from the seed CLI (db:seed:system) — upserts by (entityType, fieldKey).
   * Falls back to (entityType, columnName) lookup to handle fieldKey renames gracefully.
   */
  async registerStandardFields(entityType: string, fields: RegisterFieldInput[]): Promise<void> {
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      let existing = this.findByEntityAndKey(entityType, f.fieldKey);

      // If not found by fieldKey, try by columnName — handles fieldKey renames (e.g., snake_case -> camelCase)
      if (!existing && f.columnName) {
        existing = this.findByEntityAndColumn(entityType, f.columnName);
      }

      if (existing) {
        // Sync all code-defined properties that may have changed
        const updates: Record<string, unknown> = {};
        if (existing.fieldKey !== f.fieldKey) updates.fieldKey = f.fieldKey;
        if (existing.label !== f.label) updates.label = f.label;
        if (existing.fieldType !== f.fieldType) updates.fieldType = f.fieldType;
        if (f.columnName && existing.columnName !== f.columnName) updates.columnName = f.columnName;
        if (f.sortOrder !== undefined && existing.sortOrder !== f.sortOrder) updates.sortOrder = f.sortOrder;
        if (existing.sortOrder === 0 && f.sortOrder === undefined) updates.sortOrder = i;
        if (existing.isSystem !== (f.isSystem ?? false)) updates.isSystem = f.isSystem ?? false;
        if (existing.isUnique !== (f.isUnique ?? false)) updates.isUnique = f.isUnique ?? false;
        if (existing.isReadonly !== (f.isReadonly ?? false)) updates.isReadonly = f.isReadonly ?? false;
        if (existing.isQuickCreate !== (f.isQuickCreate ?? false)) updates.isQuickCreate = f.isQuickCreate ?? false;
        if ((f.maxLength ?? null) !== existing.maxLength) updates.maxLength = f.maxLength ?? null;
        if ((f.lookupEntity ?? null) !== existing.lookupEntity) updates.lookupEntity = f.lookupEntity ?? null;
        if ((f.lookupLabelField ?? null) !== existing.lookupLabelField) updates.lookupLabelField = f.lookupLabelField ?? null;
        if ((f.tagGroupSlug ?? null) !== existing.tagGroupSlug) updates.tagGroupSlug = f.tagGroupSlug ?? null;
        if ((f.categoryGroupSlug ?? null) !== existing.categoryGroupSlug) updates.categoryGroupSlug = f.categoryGroupSlug ?? null;
        if ((f.uiType ?? null) !== existing.uiType) updates.uiType = f.uiType ?? null;

        if (Object.keys(updates).length > 0) {
          const [row] = await this.database.db
            .update(fieldDefinitions)
            .set(updates)
            .where(withTenant(fieldDefinitions, eq(fieldDefinitions.id, existing.id)))
            .returning();
          if (row) this.replaceInCache(row as FieldDefinition);
        }
      } else {
        const [row] = await this.database.db
          .insert(fieldDefinitions)
          .values(withTenantInsert(fieldDefinitions, {
            entityType,
            fieldKey: f.fieldKey,
            label: f.label,
            fieldType: f.fieldType,
            uiType: f.uiType ?? null,
            isRequired: f.isRequired ?? false,
            isSystem: f.isSystem ?? false,
            isCustom: false,
            isUnique: f.isUnique ?? false,
            isQuickCreate: f.isQuickCreate ?? false,
            isReadonly: f.isReadonly ?? false,
            maxLength: f.maxLength ?? null,
            defaultValue: f.defaultValue ?? null,
            columnName: f.columnName ?? null,
            lookupEntity: f.lookupEntity ?? null,
            lookupLabelField: f.lookupLabelField ?? null,
            lookupSearchFields: f.lookupSearchFields ?? null,
            tagGroupSlug: f.tagGroupSlug ?? null,
            categoryGroupSlug: f.categoryGroupSlug ?? null,
            fileAccept: f.fileAccept ?? null,
            fileMaxSize: f.fileMaxSize ?? null,
            sortOrder: f.sortOrder ?? i,
          }))
          .returning();
        if (row) this.insertIntoCache(row as FieldDefinition);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Cache mutation helpers
  // ---------------------------------------------------------------------------

  private insertIntoCache(row: FieldDefinition): void {
    this.fieldsById.set(row.id, row);
    const bucket = this.fieldsByEntity.get(row.entityType) ?? [];
    bucket.push(row);
    bucket.sort((a, b) => a.sortOrder - b.sortOrder);
    this.fieldsByEntity.set(row.entityType, bucket);
  }

  private replaceInCache(row: FieldDefinition): void {
    this.fieldsById.set(row.id, row);
    const bucket = this.fieldsByEntity.get(row.entityType);
    if (!bucket) {
      this.fieldsByEntity.set(row.entityType, [row]);
      return;
    }
    const idx = bucket.findIndex((f) => f.id === row.id);
    if (idx === -1) bucket.push(row);
    else bucket[idx] = row;
    bucket.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  private removeFromCache(row: FieldDefinition): void {
    this.fieldsById.delete(row.id);
    const bucket = this.fieldsByEntity.get(row.entityType);
    if (bucket) {
      const idx = bucket.findIndex((f) => f.id === row.id);
      if (idx !== -1) bucket.splice(idx, 1);
    }
    this.picklistByField.delete(row.id);
  }
}
