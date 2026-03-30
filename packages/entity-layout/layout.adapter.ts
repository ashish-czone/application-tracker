import { Injectable } from '@nestjs/common';
import type { LayoutExtension } from '@packages/entity-engine/extensions';
import type { SeedSectionInput } from '@packages/entity-engine/types';
import { LayoutService } from './services/layout.service';

/**
 * Adapter that implements the LayoutExtension interface
 * by delegating to LayoutService.
 */
@Injectable()
export class LayoutAdapter implements LayoutExtension {
  constructor(private readonly layoutService: LayoutService) {}

  async seedDefaultLayout(entityType: string, sections: SeedSectionInput[], layoutName?: string): Promise<void> {
    return this.layoutService.seedDefaultLayout(entityType, sections, layoutName);
  }
}
