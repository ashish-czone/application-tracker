import { Module, type OnModuleInit } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { fieldTypeRegistry } from '@packages/field-types';
import { MEDIA_ASSETS_CONFIG } from './media-assets.config';
import { MediaAssetsController } from './controllers/media-assets.controller';
import { MediaAssetsUploadController } from './controllers/media-assets-upload.controller';
import { MediaAssetsService } from './services/media-assets.service';
import { MediaAssetsUploadService } from './services/media-assets-upload.service';
import { MediaAssetsResolverService } from './services/media-assets-resolver.service';
import { mediaLibraryFieldTypesPlugin } from './field-types';

/**
 * Registers the MediaAsset entity with { controller: 'none' }; the hand-
 * written MediaAssetsController owns CRUD, and MediaAssetsUploadController
 * covers the composite POST /media-assets/upload (file storage + dimension
 * extraction + row insert in one round-trip).
 *
 * Registers the `media` field type so any entity can reference a MediaAsset
 * via a single UUID column/attribute.
 */
@Module({
  imports: [EntityEngineModule.forEntity(MEDIA_ASSETS_CONFIG, { controller: 'none' })],
  controllers: [MediaAssetsController, MediaAssetsUploadController],
  providers: [MediaAssetsService, MediaAssetsUploadService, MediaAssetsResolverService],
  exports: [MediaAssetsService, MediaAssetsUploadService, MediaAssetsResolverService],
})
export class MediaLibraryModule implements OnModuleInit {
  onModuleInit() {
    if (!fieldTypeRegistry.has('media')) {
      fieldTypeRegistry.registerPlugin(mediaLibraryFieldTypesPlugin);
    }
  }
}
