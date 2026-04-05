import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, eq, asc, inArray } from '@packages/database';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import { fieldDefinitions, picklistOptions } from '@packages/entity-engine/schema';
import type {
  LayoutSection,
  FullLayout,
  FullLayoutSection,
  FullLayoutField,
  PicklistOption,
  SeedSectionInput,
} from '@packages/entity-engine/types';
import { layoutSections } from '../schema/layout-sections';
import { layoutFields } from '../schema/layout-fields';

@Injectable()
export class LayoutService {
  // In-memory layout cache: key = `${entityType}:${layoutName}`
  private layoutCache = new Map<string, { layout: FullLayout; cachedAt: number }>();
  private readonly CACHE_TTL_MS = 60_000; // 1 minute

  constructor(private readonly database: DatabaseService) {}

  // --- Section CRUD ---

  async createSection(entityType: string, layoutName: string, data: {
    name: string;
    columns?: number;
    isCollapsible?: boolean;
    isTabular?: boolean;
    tabularMaxRows?: number;
    sortOrder?: number;
  }): Promise<LayoutSection> {
    // Get max sort order
    const sections = await this.database.db
      .select()
      .from(layoutSections)
      .where(withTenant(layoutSections, eq(layoutSections.entityType, entityType), eq(layoutSections.layoutName, layoutName)))
      .orderBy(layoutSections.sortOrder);

    const maxOrder = sections.length > 0 ? Math.max(...sections.map(s => s.sortOrder)) + 1 : 0;

    const [section] = await this.database.db
      .insert(layoutSections)
      .values(withTenantInsert(layoutSections, {
        entityType,
        layoutName,
        name: data.name,
        columns: data.columns ?? 2,
        sortOrder: data.sortOrder ?? maxOrder,
        isCollapsible: data.isCollapsible ?? true,
        isTabular: data.isTabular ?? false,
        tabularMaxRows: data.tabularMaxRows ?? null,
      }))
      .returning();

    this.invalidateCache(entityType, layoutName);
    return section as LayoutSection;
  }

  async updateSection(id: string, data: {
    name?: string;
    columns?: number;
    isCollapsible?: boolean;
    sortOrder?: number;
  }): Promise<LayoutSection> {
    const existing = await this.findSectionById(id);
    if (!existing) throw new NotFoundException('Section not found');

    const updateValues: Record<string, unknown> = {};
    if (data.name !== undefined) updateValues.name = data.name;
    if (data.columns !== undefined) updateValues.columns = data.columns;
    if (data.isCollapsible !== undefined) updateValues.isCollapsible = data.isCollapsible;
    if (data.sortOrder !== undefined) updateValues.sortOrder = data.sortOrder;

    if (Object.keys(updateValues).length === 0) return existing;

    const [updated] = await this.database.db
      .update(layoutSections)
      .set(updateValues)
      .where(withTenant(layoutSections, eq(layoutSections.id, id)))
      .returning();

    this.invalidateCache(existing.entityType, existing.layoutName);
    return updated as LayoutSection;
  }

  async deleteSection(id: string): Promise<void> {
    const section = await this.findSectionById(id);
    if (!section) throw new NotFoundException('Section not found');
    await this.database.db.delete(layoutSections).where(withTenant(layoutSections, eq(layoutSections.id, id)));
    this.invalidateCache(section.entityType, section.layoutName);
  }

  async reorderSections(entityType: string, layoutName: string, orderedIds: string[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await this.database.db
        .update(layoutSections)
        .set({ sortOrder: i })
        .where(withTenant(layoutSections, eq(layoutSections.id, orderedIds[i])));
    }
    this.invalidateCache(entityType, layoutName);
  }

  // --- Field placement ---

  async addFieldToSection(sectionId: string, fieldId: string, columnIndex = 0): Promise<void> {
    const section = await this.findSectionById(sectionId);
    if (!section) throw new NotFoundException('Section not found');

    // Get max sort order in section
    const existingFields = await this.database.db
      .select()
      .from(layoutFields)
      .where(withTenant(layoutFields, eq(layoutFields.sectionId, sectionId)));

    const maxOrder = existingFields.length > 0 ? Math.max(...existingFields.map(f => f.sortOrder)) + 1 : 0;

    await this.database.db
      .insert(layoutFields)
      .values(withTenantInsert(layoutFields, { sectionId, fieldId, sortOrder: maxOrder, columnIndex }))
      .onConflictDoNothing();

    this.invalidateCache(section.entityType, section.layoutName);
  }

  async removeFieldFromSection(sectionId: string, fieldId: string): Promise<void> {
    const section = await this.findSectionById(sectionId);
    if (!section) throw new NotFoundException('Section not found');

    await this.database.db
      .delete(layoutFields)
      .where(withTenant(layoutFields, eq(layoutFields.sectionId, sectionId), eq(layoutFields.fieldId, fieldId)));

    this.invalidateCache(section.entityType, section.layoutName);
  }

  async reorderFieldsInSection(
    sectionId: string,
    orderedFields: string[] | { fieldId: string; columnIndex: number }[],
  ): Promise<void> {
    const section = await this.findSectionById(sectionId);
    if (!section) throw new NotFoundException('Section not found');

    for (let i = 0; i < orderedFields.length; i++) {
      const item = orderedFields[i];
      const isObject = typeof item === 'object';
      const fieldId = isObject ? item.fieldId : item;
      const columnIndex = isObject ? item.columnIndex : undefined;

      const setValues: Record<string, unknown> = { sortOrder: i };
      if (columnIndex !== undefined) setValues.columnIndex = columnIndex;

      await this.database.db
        .update(layoutFields)
        .set(setValues)
        .where(withTenant(layoutFields,
          eq(layoutFields.sectionId, sectionId),
          eq(layoutFields.fieldId, fieldId),
        ));
    }
    this.invalidateCache(section.entityType, section.layoutName);
  }

  // --- Full layout retrieval ---

  async getLayout(entityType: string, layoutName = 'Standard'): Promise<FullLayout> {
    // Check cache
    const cacheKey = `${entityType}:${layoutName}`;
    const cached = this.layoutCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached.layout;
    }

    // Fetch sections
    const sections = await this.database.db
      .select()
      .from(layoutSections)
      .where(withTenant(layoutSections,
        eq(layoutSections.entityType, entityType),
        eq(layoutSections.layoutName, layoutName),
      ))
      .orderBy(asc(layoutSections.sortOrder));

    // Fetch all field definitions for this entity
    const allFields = await this.database.db
      .select()
      .from(fieldDefinitions)
      .where(withTenant(fieldDefinitions, eq(fieldDefinitions.entityType, entityType)))
      .orderBy(asc(fieldDefinitions.sortOrder));

    // Fetch all layout field assignments for these sections
    const sectionIds = sections.map(s => s.id);
    const allLayoutFields = sectionIds.length > 0
      ? await this.database.db
          .select()
          .from(layoutFields)
          .where(withTenant(layoutFields, inArray(layoutFields.sectionId, sectionIds)))
          .orderBy(asc(layoutFields.sortOrder))
      : [];

    // Fetch all picklist options for all fields
    const fieldIds = allFields.map(f => f.id);
    const allPicklistOptions = fieldIds.length > 0
      ? await this.database.db
          .select()
          .from(picklistOptions)
          .where(withTenant(picklistOptions, inArray(picklistOptions.fieldId, fieldIds)))
          .orderBy(asc(picklistOptions.sortOrder))
      : [];

    // Build lookup maps
    const fieldMap = new Map(allFields.map(f => [f.id, f]));
    const picklistMap = new Map<string, PicklistOption[]>();
    for (const opt of allPicklistOptions) {
      const existing = picklistMap.get(opt.fieldId) ?? [];
      existing.push(opt as PicklistOption);
      picklistMap.set(opt.fieldId, existing);
    }

    // Track which fields are placed
    const placedFieldIds = new Set(allLayoutFields.map(lf => lf.fieldId));

    // Build sections with fields
    const fullSections: FullLayoutSection[] = sections.map(section => {
      const sectionLayoutFields = allLayoutFields
        .filter(lf => lf.sectionId === section.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      const fields: FullLayoutField[] = sectionLayoutFields
        .map(lf => {
          const field = fieldMap.get(lf.fieldId);
          if (!field) return null;
          return {
            ...(field as FullLayoutField),
            picklistOptions: picklistMap.get(field.id) ?? [],
            columnIndex: lf.columnIndex,
          };
        })
        .filter(Boolean) as FullLayoutField[];

      return {
        id: section.id,
        name: section.name,
        columns: section.columns,
        sortOrder: section.sortOrder,
        isCollapsible: section.isCollapsible,
        isTabular: section.isTabular,
        tabularMaxRows: section.tabularMaxRows,
        fields,
      };
    });

    // Virtual "Unassigned Fields" section for fields not in any section
    const unassignedFields = allFields
      .filter(f => !placedFieldIds.has(f.id))
      .map(f => ({
        ...(f as FullLayoutField),
        picklistOptions: picklistMap.get(f.id) ?? [],
        columnIndex: 0,
      }));

    if (unassignedFields.length > 0) {
      fullSections.push({
        id: '__unassigned__',
        name: 'Unassigned Fields',
        columns: 2,
        sortOrder: 999,
        isCollapsible: true,
        isTabular: false,
        tabularMaxRows: null,
        fields: unassignedFields,
      });
    }

    // Quick create fields
    const quickCreateFields = allFields
      .filter(f => f.isQuickCreate)
      .map(f => ({
        ...(f as FullLayoutField),
        picklistOptions: picklistMap.get(f.id) ?? [],
        columnIndex: 0,
      }));

    const layout: FullLayout = {
      entityType,
      layoutName,
      sections: fullSections,
      quickCreateFields,
    };

    // Cache it
    this.layoutCache.set(cacheKey, { layout, cachedAt: Date.now() });

    return layout;
  }

  /**
   * Idempotent default layout seeding. Creates sections and assigns fields.
   * Skips if sections already exist for this entity+layout.
   */
  async seedDefaultLayout(entityType: string, sections: SeedSectionInput[], layoutName = 'Standard'): Promise<void> {
    // Check if layout already seeded
    const existing = await this.database.db
      .select()
      .from(layoutSections)
      .where(withTenant(layoutSections,
        eq(layoutSections.entityType, entityType),
        eq(layoutSections.layoutName, layoutName),
      ))
      .limit(1);

    if (existing.length > 0) return; // Already seeded

    for (let sIdx = 0; sIdx < sections.length; sIdx++) {
      const sec = sections[sIdx];

      const [section] = await this.database.db
        .insert(layoutSections)
        .values(withTenantInsert(layoutSections, {
          entityType,
          layoutName,
          name: sec.name,
          columns: sec.columns ?? 2,
          sortOrder: sIdx,
          isCollapsible: sec.isCollapsible ?? true,
          isTabular: sec.isTabular ?? false,
          tabularMaxRows: sec.tabularMaxRows ?? null,
        }))
        .returning();

      // Assign fields to section
      for (let fIdx = 0; fIdx < sec.fields.length; fIdx++) {
        const entry = sec.fields[fIdx];
        const fieldKey = Array.isArray(entry) ? entry[0] : entry;
        const columnIndex = Array.isArray(entry) ? entry[1] : (fIdx % 2);

        // Look up field definition by key
        const [field] = await this.database.db
          .select()
          .from(fieldDefinitions)
          .where(withTenant(fieldDefinitions,
            eq(fieldDefinitions.entityType, entityType),
            eq(fieldDefinitions.fieldKey, fieldKey),
          ))
          .limit(1);

        if (field) {
          await this.database.db
            .insert(layoutFields)
            .values(withTenantInsert(layoutFields, {
              sectionId: section.id,
              fieldId: field.id,
              sortOrder: fIdx,
              columnIndex,
            }));
        }
      }
    }

    this.invalidateCache(entityType, layoutName);
  }

  // --- Private helpers ---

  private async findSectionById(id: string): Promise<LayoutSection | null> {
    const [section] = await this.database.db
      .select()
      .from(layoutSections)
      .where(withTenant(layoutSections, eq(layoutSections.id, id)))
      .limit(1);
    return (section as LayoutSection) ?? null;
  }

  private invalidateCache(entityType: string, layoutName: string): void {
    this.layoutCache.delete(`${entityType}:${layoutName}`);
  }
}
