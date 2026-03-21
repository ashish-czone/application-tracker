import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { DatabaseService, eq, and, count } from '@packages/database';
import { fieldDefinitions } from '../schema/field-definitions';
import { picklistOptions } from '../schema/picklist-options';
import { entityFieldValues } from '../schema/entity-field-values';
import type { FieldDefinition, PicklistOption, FieldType, RegisterFieldInput, SetPicklistOptionInput } from '../types';

@Injectable()
export class FieldDefinitionService {
  constructor(private readonly database: DatabaseService) {}

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
  }): Promise<FieldDefinition> {
    // Check field_key uniqueness
    const existing = await this.findByEntityAndKey(entityType, data.fieldKey);
    if (existing) {
      throw new ConflictException(`Field '${data.fieldKey}' already exists for entity '${entityType}'`);
    }

    const [field] = await this.database.db
      .insert(fieldDefinitions)
      .values({
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
      })
      .returning();

    return field as FieldDefinition;
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
    const existing = await this.findById(id);
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
      .where(eq(fieldDefinitions.id, id))
      .returning();

    return updated as FieldDefinition;
  }

  async delete(id: string): Promise<void> {
    const field = await this.findById(id);
    if (!field) throw new NotFoundException('Field not found');
    if (!field.isCustom) throw new BadRequestException('Cannot delete system or standard fields');

    // Check if field has values
    const [{ total }] = await this.database.db
      .select({ total: count() })
      .from(entityFieldValues)
      .where(and(
        eq(entityFieldValues.entityType, field.entityType),
        eq(entityFieldValues.fieldKey, field.fieldKey),
      ));

    if (Number(total) > 0) {
      throw new ConflictException(
        `Cannot delete field '${field.fieldKey}': ${total} entities have values. Delete values first.`,
      );
    }

    await this.database.db.delete(fieldDefinitions).where(eq(fieldDefinitions.id, id));
  }

  async findById(id: string): Promise<FieldDefinition | null> {
    const [field] = await this.database.db
      .select()
      .from(fieldDefinitions)
      .where(eq(fieldDefinitions.id, id))
      .limit(1);
    return (field as FieldDefinition) ?? null;
  }

  async findByEntityAndKey(entityType: string, fieldKey: string): Promise<FieldDefinition | null> {
    const [field] = await this.database.db
      .select()
      .from(fieldDefinitions)
      .where(and(
        eq(fieldDefinitions.entityType, entityType),
        eq(fieldDefinitions.fieldKey, fieldKey),
      ))
      .limit(1);
    return (field as FieldDefinition) ?? null;
  }

  async listByEntity(entityType: string): Promise<FieldDefinition[]> {
    const fields = await this.database.db
      .select()
      .from(fieldDefinitions)
      .where(eq(fieldDefinitions.entityType, entityType))
      .orderBy(fieldDefinitions.sortOrder);
    return fields as FieldDefinition[];
  }

  async getPicklistOptions(fieldId: string): Promise<PicklistOption[]> {
    const options = await this.database.db
      .select()
      .from(picklistOptions)
      .where(eq(picklistOptions.fieldId, fieldId))
      .orderBy(picklistOptions.sortOrder);
    return options as PicklistOption[];
  }

  async setPicklistOptions(
    entityType: string,
    fieldKey: string,
    options: SetPicklistOptionInput[],
  ): Promise<void> {
    const field = await this.findByEntityAndKey(entityType, fieldKey);
    if (!field) throw new NotFoundException(`Field '${fieldKey}' not found for entity '${entityType}'`);

    if (field.fieldType !== 'picklist' && field.fieldType !== 'multi_select') {
      throw new BadRequestException('Picklist options can only be set on picklist or multi_select fields');
    }

    // Delete existing options and re-insert
    await this.database.db
      .delete(picklistOptions)
      .where(eq(picklistOptions.fieldId, field.id));

    if (options.length > 0) {
      await this.database.db
        .insert(picklistOptions)
        .values(options.map((opt, idx) => ({
          fieldId: field.id,
          label: opt.label,
          value: opt.value,
          isDefault: opt.isDefault ?? false,
          sortOrder: idx,
        })));
    }
  }

  /**
   * Idempotent registration of standard fields for a module.
   * Called in onModuleInit — upserts by (entityType, fieldKey).
   */
  async registerStandardFields(entityType: string, fields: RegisterFieldInput[]): Promise<void> {
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      const existing = await this.findByEntityAndKey(entityType, f.fieldKey);

      if (existing) {
        // Update sortOrder and column mapping if changed, but don't override admin customizations
        const updates: Record<string, unknown> = {};
        if (f.columnName && existing.columnName !== f.columnName) updates.columnName = f.columnName;
        if (f.sortOrder !== undefined && existing.sortOrder !== f.sortOrder) updates.sortOrder = f.sortOrder;
        if (existing.sortOrder === 0 && f.sortOrder === undefined) updates.sortOrder = i;

        if (Object.keys(updates).length > 0) {
          await this.database.db
            .update(fieldDefinitions)
            .set(updates)
            .where(eq(fieldDefinitions.id, existing.id));
        }
      } else {
        await this.database.db
          .insert(fieldDefinitions)
          .values({
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
            sortOrder: f.sortOrder ?? i,
          });
      }
    }
  }
}
