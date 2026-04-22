import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { MEDIA_ASSETS_CONFIG } from './media-assets.config';
import { MediaAssetsUploadController } from './controllers/media-assets-upload.controller';
import { MediaAssetsUploadService } from './services/media-assets-upload.service';

/**
 * Registers the MediaAsset entity with the entity-engine. CRUD
 * controllers, permissions (media-assets.{read,create,update,delete}),
 * audit events, search, pagination are auto-generated.
 *
 * Adds POST /media-assets/upload — a composite endpoint that stores
 * the file via @packages/media, extracts image dimensions, and writes
 * a MediaAsset row in one round-trip (gated by media-assets.create).
 */
@Module({
  imports: [EntityEngineModule.forEntity(MEDIA_ASSETS_CONFIG)],
  controllers: [MediaAssetsUploadController],
  providers: [MediaAssetsUploadService],
  exports: [MediaAssetsUploadService],
})
export class MediaLibraryModule {}
