import { Module, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import { DatabaseService, eq, and, isNull } from '@packages/database';
import { EntityEngineModule } from '@packages/entity-engine';
import { PagesModule } from '@packages/pages-api';
import { MENU_CONFIG } from './menus.config';
import { menuItemConfig, registerMenuItemDepthLookup } from './menu-items.config';
import { menuItems } from './schema/menu-items';
import { MenusController } from './controllers/menus.controller';
import { MenuItemsController } from './controllers/menu-items.controller';
import { MenusPublicController } from './controllers/menus-public.controller';
import { MenusService } from './services/menus.service';
import { MenuItemsService } from './services/menu-items.service';
import { MenusPublicService } from './services/menus-public.service';

/**
 * Hand-written CRUD controllers for menus + menu_items; forEntity skips the
 * auto-mounted controller. The public controller exposes GET /public/menus/:slug
 * alongside the admin CRUD. The depth-lookup callback stays wired here because
 * entity-engine hooks are plain functions with no DI access.
 */
@Module({
  imports: [
    EntityEngineModule.forEntity(MENU_CONFIG),
    EntityEngineModule.forEntity(menuItemConfig),
    PagesModule,
  ],
  controllers: [MenusController, MenuItemsController, MenusPublicController],
  providers: [MenusService, MenuItemsService, MenusPublicService],
  exports: [MenusService, MenuItemsService, MenusPublicService],
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
