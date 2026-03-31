import { Injectable } from '@nestjs/common';
import type { EavStorageExtension } from '@packages/entity-engine/extensions';
import { FieldValueService } from './services/field-value.service';

/**
 * Adapter that implements the EavStorageExtension interface
 * by delegating to FieldValueService.
 */
@Injectable()
export class EavStorageAdapter implements EavStorageExtension {
  constructor(
    private readonly fieldValueService: FieldValueService,
  ) {}

  async getValues(entityType: string, entityId: string, tx?: any): Promise<Record<string, unknown>> {
    return this.fieldValueService.getValues(entityType, entityId, tx);
  }

  async getBatchValues(entityType: string, entityIds: string[]): Promise<Map<string, Record<string, unknown>>> {
    return this.fieldValueService.getBatchValues(entityType, entityIds);
  }

  async setValues(entityType: string, entityId: string, values: Record<string, unknown>, tx?: any): Promise<{ before: Record<string, unknown>; after: Record<string, unknown> }> {
    return this.fieldValueService.setValues(entityType, entityId, values, tx);
  }

  buildFilterCondition(entityType: string, entityIdColumn: any, filters: { fieldKey: string; operator: any; value: any }[]): any {
    return this.fieldValueService.buildFilterCondition(entityType, entityIdColumn, filters);
  }

  async checkUniqueness(entityType: string, fieldKey: string, value: unknown, excludeEntityId?: string): Promise<boolean> {
    return this.fieldValueService.checkUniqueness(entityType, fieldKey, value, excludeEntityId);
  }
}
