import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { RbacService } from '@packages/rbac';
import { fieldTypeRegistry } from '@packages/field-types';
import { taxonomyFieldTypesPlugin } from './field-types';
import { TaxonomyService } from './services/taxonomy.service';
import { CategoryService } from './services/category.service';
import { TagsController } from './controllers/tags.controller';
import { CategoriesController } from './controllers/categories.controller';

@Global()
@Module({
  controllers: [TagsController, CategoriesController],
  providers: [TaxonomyService, CategoryService],
  exports: [TaxonomyService, CategoryService],
})
export class TaxonomyModule implements OnModuleInit {
  constructor(private readonly rbacService: RbacService) {}

  onModuleInit() {
    if (!fieldTypeRegistry.has('tags')) {
      fieldTypeRegistry.registerPlugin(taxonomyFieldTypesPlugin);
    }

    this.rbacService.registerPermissions('taxonomy', [
      { action: 'tag-groups.read', description: 'View tag groups' },
      { action: 'tag-groups.manage', description: 'Create, update, and delete tag groups' },
      { action: 'tags.read', description: 'View tags' },
      { action: 'tags.manage', description: 'Create, update, and delete tags' },
      { action: 'categories.read', description: 'View categories' },
      { action: 'categories.manage', description: 'Create, update, move, and delete categories' },
    ]);
  }
}
