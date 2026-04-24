import { Module, type OnModuleInit } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { fieldTypeRegistry } from '@packages/field-types';
import { dataSourceFieldTypePlugin } from '@packages/blocks-contract';
import { PAGES_CONFIG } from './pages.config';
import { SECTIONS_CONFIG } from './sections.config';
import { PagesController } from './controllers/pages.controller';
import { SectionsController } from './controllers/sections.controller';
import { PagesPublicController } from './controllers/pages-public.controller';
import { PagesService } from './services/pages.service';
import { SectionsService } from './services/sections.service';
import { PagesPublicService } from './services/pages-public.service';

/**
 * Hand-written CRUD controllers for `pages` and `sections` back the admin UI;
 * forEntity registrations skip the auto-mounted generic controller. The
 * public controller exposes the two non-CRUD endpoints (slug lookup + bulk
 * reorder). Registers the `data_source` field type at boot so
 * `sections.dataSource` flows through the generic CRUD pipeline.
 */
@Module({
  imports: [
    EntityEngineModule.forEntity(PAGES_CONFIG),
    EntityEngineModule.forEntity(SECTIONS_CONFIG),
  ],
  controllers: [PagesController, SectionsController, PagesPublicController],
  providers: [PagesService, SectionsService, PagesPublicService],
  exports: [PagesService, SectionsService, PagesPublicService],
})
export class PagesModule implements OnModuleInit {
  onModuleInit() {
    if (!fieldTypeRegistry.has('data_source')) {
      fieldTypeRegistry.registerPlugin(dataSourceFieldTypePlugin);
    }
  }
}
