import type { EntityConfig, SeedSectionInput } from '../types';

/**
 * Interface for layout seeding operations.
 * Implemented by @packages/entity-layout when loaded.
 * When not loaded, layout seeding is skipped.
 */
export interface LayoutExtension {
  /** Seed default layout sections and field assignments for an entity. */
  seedDefaultLayout(entityType: string, sections: SeedSectionInput[], layoutName?: string): Promise<void>;
}

/** NestJS injection token for the layout extension. */
export const LAYOUT_EXTENSION = 'LAYOUT_EXTENSION';
