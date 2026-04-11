import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { RbacService } from '@packages/rbac';
import { fieldTypeRegistry } from '@packages/field-types';
import { fieldTypeSaveHookRegistry, TAXONOMY_EXTENSION } from '@packages/entity-engine';
import { ActionRegistry } from '@packages/automation-contracts';
import { taxonomyFieldTypesPlugin } from './field-types';
import { TaxonomyService } from './services/taxonomy.service';
import { CategoryService } from './services/category.service';
import { TagEntityAction } from './actions/tag-entity.action';
import { TaxonomyExtensionAdapter } from './taxonomy-extension.adapter';
import { TagsController } from './controllers/tags.controller';
import { CategoriesController } from './controllers/categories.controller';

@Global()
@Module({
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
    private readonly taxonomyService: TaxonomyService,
    private readonly actionRegistry: ActionRegistry,
    private readonly tagEntityAction: TagEntityAction,
  ) {}

  onModuleInit() {
    if (!fieldTypeRegistry.has('tags')) {
      fieldTypeRegistry.registerPlugin(taxonomyFieldTypesPlugin);
    }

    // Register tags save hook — handles attach/detach within the caller's transaction
    if (!fieldTypeSaveHookRegistry.has('tags')) {
      fieldTypeSaveHookRegistry.register('tags', {
        onTransactionalSave: async (value, ctx, tx) => {
          if (!Array.isArray(value)) return;
          const tagIds = value.filter((v): v is string => typeof v === 'string');

          if (ctx.mode === 'create') {
            for (const tagId of tagIds) {
              await this.taxonomyService.attachTag(ctx.entityType, ctx.entityId, tagId, tx);
            }
          } else {
            // Update: diff current vs new
            const currentTags = await this.taxonomyService.getTagsForEntity(ctx.entityType, ctx.entityId, tx);
            const currentIds = new Set(currentTags.map(t => t.id));
            const newIds = new Set(tagIds);

            for (const id of currentIds) {
              if (!newIds.has(id)) {
                await this.taxonomyService.detachTag(ctx.entityType, ctx.entityId, id, tx);
              }
            }
            for (const id of newIds) {
              if (!currentIds.has(id)) {
                await this.taxonomyService.attachTag(ctx.entityType, ctx.entityId, id, tx);
              }
            }
          }
        },
      });
    }

    this.actionRegistry.register(this.tagEntityAction);

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
