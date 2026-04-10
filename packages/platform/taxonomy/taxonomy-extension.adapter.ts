import { Injectable } from '@nestjs/common';
import type { TaxonomyExtension, TagRef } from '@packages/entity-engine/extensions';
import { TaxonomyService } from './services/taxonomy.service';

/**
 * Adapter that implements entity-engine's TaxonomyExtension interface
 * by delegating to TaxonomyService.
 */
@Injectable()
export class TaxonomyExtensionAdapter implements TaxonomyExtension {
  constructor(private readonly taxonomyService: TaxonomyService) {}

  async getTagsForEntity(entityType: string, entityId: string): Promise<TagRef[]> {
    return this.taxonomyService.getTagsForEntity(entityType, entityId);
  }
}
