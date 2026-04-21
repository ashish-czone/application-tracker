import { Module, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import { DatabaseService, eq, and, isNull } from '@packages/database';
import { EntityEngineModule } from '@packages/entity-engine';
import { PagesModule } from '@packages/pages-api';
import { MENU_CONFIG } from './menus.config';
import { menuItemConfig, registerMenuItemDepthLookup } from './menu-items.config';
import { menuItems } from './schema/menu-items';
import { MenusPublicController } from './controllers/menus-public.controller';
import { MenusPublicService } from './services/menus-public.service';

/**
 * MenusModule registers two entities with the entity-engine:
 *   - `menus` — flat containers, queried by slug from the customer portal.
 *   - `menu_items` — hierarchy + orderable entries, 2-level deep.
 *
 * CRUD controllers, permissions, audit events, field definitions, and the
 * auto-generated /move endpoint all come from the engine. The one non-
 * generated route is GET /public/menus/:slug on MenusPublicController.
 *
 * The config hooks call back into the DB to enforce the 2-level cap on
 * create/update. The callback is populated here at module init because
 * entity-engine hooks are plain functions with no DI access.
 */
@Module({
  imports: [
    EntityEngineModule.forEntity(MENU_CONFIG),
    EntityEngineModule.forEntity(menuItemConfig),
    PagesModule,
  ],
  controllers: [MenusPublicController],
  providers: [MenusPublicService],
  exports: [MenusPublicService],
})
export class MenusModule implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly database: DatabaseService) {}

  onModuleInit(): void {
    registerMenuItemDepthLookup(async (parentId: string) => {
      const [parent] = await this.database.db
        .select({ depth: menuItems.depth })
        .from(menuItems)
        .where(and(eq(menuItems.id, parentId), isNull(menuItems.deletedAt)))
        .limit(1);
      return parent?.depth ?? null;
    });
  }

  onModuleDestroy(): void {
    registerMenuItemDepthLookup(null);
  }
}
