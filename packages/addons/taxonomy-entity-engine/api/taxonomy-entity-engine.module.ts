import { Global, Module } from '@nestjs/common';
import { TAXONOMY_EXTENSION } from '@packages/entity-engine';
import { TaxonomyModule } from '@packages/taxonomy';
import { TaxonomyExtensionAdapter } from './taxonomy-extension.adapter';

/**
 * Binds the taxonomy runtime to entity-engine.
 *
 * Apps that wire entity-engine and want per-entity-factory tag resolution
 * (the `getTagsForEntity` extension call entity-engine makes when reading
 * an entity row) should import this module. Apps that use
 * `@packages/taxonomy` standalone — calling `TaxonomyService` directly
 * for tag CRUD or category management — do NOT need this module.
 *
 * @Global() because the per-entity factory in entity-engine resolves
 * `TAXONOMY_EXTENSION` via DI token across module boundaries — same
 * convention as the other entity-engine extensions documented as known
 * architectural debt in CLAUDE.md.
 */
@Global()
@Module({
  imports: [TaxonomyModule],
  providers: [
    TaxonomyExtensionAdapter,
    {
      provide: TAXONOMY_EXTENSION,
      useExisting: TaxonomyExtensionAdapter,
    },
  ],
  exports: [TAXONOMY_EXTENSION],
})
export class TaxonomyEntityEngineModule {}
