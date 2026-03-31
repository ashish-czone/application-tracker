import { Injectable } from '@nestjs/common';
import type { EavStorageExtension } from '@packages/entity-engine/extensions';
import { FieldValueService } from './services/field-value.service';
import { MultiValueService } from './services/multi-value.service';

/**
 * Adapter that implements the EavStorageExtension interface
 * by delegating to FieldValueService and MultiValueService.
 */
@Injectable()
export class EavStorageAdapter implements EavStorageExtension {
  constructor(
    private readonly fieldValueService: FieldValueService,
    private readonly multiValueService: MultiValueService,
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

  async setMultiValues(entityType: string, entityId: string, fieldKey: string, targetIds: string[], tx?: any): Promise<void> {
    return this.multiValueService.setValues(entityType, entityId, fieldKey, targetIds, tx);
  }

  async getAllMultiValues(entityType: string, entityId: string): Promise<Record<string, string[]>> {
    return this.multiValueService.getAllForEntity(entityType, entityId);
  }
}
