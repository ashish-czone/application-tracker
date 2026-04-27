import { Module, type OnModuleInit } from '@nestjs/common';
import { RbacService } from '@packages/rbac';
import { fieldTypeRegistry } from '@packages/field-types';
import { TAXONOMY_EXTENSION } from '@packages/entity-engine';
import { ActionRegistry } from '@packages/automation-contracts';
import { HierarchyModule } from '@packages/hierarchy';
import { taxonomyFieldTypesPlugin } from './field-types';
import { TaxonomyService } from './services/taxonomy.service';
import { CategoryService } from './services/category.service';
import { TagEntityAction } from './actions/tag-entity.action';
import { TaxonomyExtensionAdapter } from './taxonomy-extension.adapter';
import { TagsController } from './controllers/tags.controller';
import { CategoriesController } from './controllers/categories.controller';

@Module({
  imports: [HierarchyModule],
  controllers: [TagsController, CategoriesController],
  providers: [
    TaxonomyService,
    CategoryService,
    TagEntityAction,
    TaxonomyExtensionAdapter,
    {
      provide: TAXONOMY_EXTENSION,
      useExisting: TaxonomyExtensionAdapter,
    },
  ],
  exports: [TaxonomyService, CategoryService, TAXONOMY_EXTENSION],
})
export class TaxonomyModule implements OnModuleInit {
  constructor(
    private readonly rbacService: RbacService,
    private readonly actionRegistry: ActionRegistry,
    private readonly tagEntityAction: TagEntityAction,
  ) {}

  onModuleInit() {
    if (!fieldTypeRegistry.has('tags')) {
      fieldTypeRegistry.registerPlugin(taxonomyFieldTypesPlugin);
    }

    this.actionRegistry.register(this.tagEntityAction);

    this.rbacService.registerManifests([
      { slug: 'taxonomy.tag-groups.read',     module: 'taxonomy', action: 'tag-groups.read',     label: 'View tag groups',        description: 'View tag groups',                               supportedScopes: ['any'] },
      { slug: 'taxonomy.tag-groups.manage',   module: 'taxonomy', action: 'tag-groups.manage',   label: 'Manage tag groups',      description: 'Create, update, and delete tag groups',         supportedScopes: ['any'] },
      { slug: 'taxonomy.tags.read',           module: 'taxonomy', action: 'tags.read',           label: 'View tags',              description: 'View tags',                                     supportedScopes: ['any'] },
      { slug: 'taxonomy.tags.manage',         module: 'taxonomy', action: 'tags.manage',         label: 'Manage tags',            description: 'Create, update, and delete tags',               supportedScopes: ['any'] },
      { slug: 'taxonomy.entity-tags.manage',  module: 'taxonomy', action: 'entity-tags.manage',  label: 'Manage entity tags',     description: 'Attach and detach tags on entities',            supportedScopes: ['any'] },
      { slug: 'taxonomy.categories.read',     module: 'taxonomy', action: 'categories.read',     label: 'View categories',        description: 'View categories',                               supportedScopes: ['any'] },
      { slug: 'taxonomy.categories.manage',   module: 'taxonomy', action: 'categories.manage',   label: 'Manage categories',      description: 'Create, update, move, and delete categories',   supportedScopes: ['any'] },
    ]);
  }
}
