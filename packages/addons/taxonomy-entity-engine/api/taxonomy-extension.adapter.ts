import { Injectable } from '@nestjs/common';
import type { TaxonomyExtension, TagRef } from '@packages/entity-engine/extensions';
import { TaxonomyService } from '@packages/taxonomy';

/**
 * Adapter that implements entity-engine's TaxonomyExtension interface
 * by delegating to TaxonomyService.
 *
 * Lives in `@packages/taxonomy-entity-engine` so the taxonomy package
 * itself stays free of entity-engine imports — only consumers that wire
 * entity-engine + taxonomy together pull this binding.
 */
@Injectable()
export class TaxonomyExtensionAdapter implements TaxonomyExtension {
  constructor(private readonly taxonomyService: TaxonomyService) {}

  async getTagsForEntity(entityType: string, entityId: string): Promise<TagRef[]> {
    return this.taxonomyService.getTagsForEntity(entityType, entityId);
  }
}
