import { Injectable } from '@nestjs/common';
import { EntityRegistryService } from '../entity-registry.service';
import { buildInMemoryFields, buildInMemoryLayout } from '../helpers/build-in-memory-definitions';
import type { FullLayout, FullLayoutField } from '../types';

/**
 * Resolves an entity's field definitions and layout from code when the entity
 * opts out of admin-configurable behaviour. Callers route reads through this
 * service so non-admin-configurable entities never touch the database for
 * their definitions.
 *
 * The companion DB-backed path (FieldDefinitionService / LayoutService) stays
 * as-is for admin-configurable entities; the flag-based routing is wired by
 * the DB services themselves in Task 3 — this service only owns the
 * in-memory branch.
 */
@Injectable()
export class EntityDefinitionService {
  constructor(private readonly registry: EntityRegistryService) {}

  /** True when the entity stores its definitions in the DB (admin-editable). */
  isAdminConfigurable(entityType: string): boolean {
    return !!this.registry.get(entityType)?.adminConfigurable;
  }

  /**
   * Returns every field an entity declares in code, including implicit system
   * fields (createdBy/createdAt/updatedAt) when the table has those columns.
   * Picklist options declared via `fieldMeta.picklistOptions` are attached
   * inline. Returns `[]` if the entity is not registered.
   *
   * For entities that declare `extensionOf`, the parent's projected fields
   * are merged in — callers that render forms or lay out sections see a
   * single unified field list.
   */
  resolveFieldsFromRegistry(entityType: string): FullLayoutField[] {
    const config = this.registry.get(entityType);
    if (!config) return [];
    return buildInMemoryFields(config, this.resolveExtensionContext(entityType));
  }

  /**
   * Returns a `FullLayout` built from the entity's code-defined sections.
   * Matches the shape of `LayoutService.getLayout` so downstream consumers
   * can treat the two interchangeably. Returns an empty layout if the entity
   * is not registered. For extensionOf entities the parent's projected
   * fields are available to place in the child's sections by fieldKey.
   */
  resolveLayoutFromRegistry(entityType: string, layoutName = 'Standard'): FullLayout {
    const config = this.registry.get(entityType);
    if (!config) {
      return { entityType, layoutName, sections: [], quickCreateFields: [] };
    }
    return buildInMemoryLayout(config, layoutName, this.resolveExtensionContext(entityType));
  }

  private resolveExtensionContext(entityType: string) {
    const ext = this.registry.getResolvedExtension(entityType);
    if (!ext) return undefined;
    const parentConfig = this.registry.get(ext.parentEntityType);
    if (!parentConfig) return undefined;
    return {
      parentConfig,
      projectedKeys: ext.projectedColumns.map((c) => c.fieldKey),
    };
  }
}
