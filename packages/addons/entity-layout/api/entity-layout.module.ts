import { Global, Module } from '@nestjs/common';
import { LAYOUT_EXTENSION } from '@packages/entity-engine/extensions';
import { LayoutService } from './services/layout.service';
import { LayoutsController } from './controllers/layouts.controller';
import { LayoutAdapter } from './layout.adapter';

/**
 * Entity Layout Module — optional DB-driven layout customization.
 *
 * When imported, provides the LAYOUT_EXTENSION to entity-engine,
 * enabling layout seeding and the layout management API.
 *
 * Without this module, entity-engine skips layout seeding.
 */
@Global()
@Module({
  controllers: [LayoutsController],
  providers: [
    LayoutService,
    LayoutAdapter,
    {
      provide: LAYOUT_EXTENSION,
      useExisting: LayoutAdapter,
    },
  ],
  exports: [LayoutService, LAYOUT_EXTENSION],
})
export class EntityLayoutModule {}
