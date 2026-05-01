import { Module, type OnModuleInit } from '@nestjs/common';
import { RbacIntegrationModule } from '@packages/rbac';
import { fieldTypeRegistry } from '@packages/field-types';
import { ActionRegistry } from '@packages/automation-contracts';
import { HierarchyModule } from '@packages/hierarchy';
import { taxonomyFieldTypesPlugin } from './field-types';
import { TaxonomyService } from './services/taxonomy.service';
import { CategoryService } from './services/category.service';
import { TagEntityAction } from './actions/tag-entity.action';
import { TagsController } from './controllers/tags.controller';
import { CategoriesController } from './controllers/categories.controller';

/**
 * Taxonomy runtime: tags + categories + REST surface + tag-entity action.
 *
 * This module is entity-engine-free. To bind taxonomy to entity-engine
 * (so the per-entity factory's `getTagsForEntity` extension call resolves),
 * import `@packages/taxonomy-entity-engine`'s `TaxonomyEntityEngineModule`
 * alongside this one.
 *
 * Standalone consumers (e.g., domains calling `TaxonomyService` directly
 * to manage tags) need only this module.
 */
@Module({
  imports: [
    HierarchyModule,
    RbacIntegrationModule.forFeature({
      manifests: [
        { slug: 'taxonomy.tag-groups.read',     module: 'taxonomy', action: 'tag-groups.read',     label: 'View tag groups',        description: 'View tag groups',                               supportedScopes: ['any'] },
        { slug: 'taxonomy.tag-groups.manage',   module: 'taxonomy', action: 'tag-groups.manage',   label: 'Manage tag groups',      description: 'Create, update, and delete tag groups',         supportedScopes: ['any'] },
        { slug: 'taxonomy.tags.read',           module: 'taxonomy', action: 'tags.read',           label: 'View tags',              description: 'View tags',                                     supportedScopes: ['any'] },
        { slug: 'taxonomy.tags.manage',         module: 'taxonomy', action: 'tags.manage',         label: 'Manage tags',            description: 'Create, update, and delete tags',               supportedScopes: ['any'] },
        { slug: 'taxonomy.entity-tags.manage',  module: 'taxonomy', action: 'entity-tags.manage',  label: 'Manage entity tags',     description: 'Attach and detach tags on entities',            supportedScopes: ['any'] },
        { slug: 'taxonomy.categories.read',     module: 'taxonomy', action: 'categories.read',     label: 'View categories',        description: 'View categories',                               supportedScopes: ['any'] },
        { slug: 'taxonomy.categories.manage',   module: 'taxonomy', action: 'categories.manage',   label: 'Manage categories',      description: 'Create, update, move, and delete categories',   supportedScopes: ['any'] },
      ],
    }),
  ],
  controllers: [TagsController, CategoriesController],
  providers: [
    TaxonomyService,
    CategoryService,
    TagEntityAction,
  ],
  exports: [TaxonomyService, CategoryService],
})
export class TaxonomyModule implements OnModuleInit {
  constructor(
    private readonly actionRegistry: ActionRegistry,
    private readonly tagEntityAction: TagEntityAction,
  ) {}

  onModuleInit() {
    if (!fieldTypeRegistry.has('tags')) {
      fieldTypeRegistry.registerPlugin(taxonomyFieldTypesPlugin);
    }

    this.actionRegistry.register(this.tagEntityAction);
  }
}
