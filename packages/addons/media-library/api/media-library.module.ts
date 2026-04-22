import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { MEDIA_ASSETS_CONFIG } from './media-assets.config';

/**
 * Registers the MediaAsset entity with the entity-engine. CRUD
 * controllers, permissions, audit events, search, pagination are all
 * auto-generated.
 *
 * The composite upload endpoint (POST /media-assets/upload) is added
 * in F5.3 via a dedicated controller that wraps @packages/media storage
 * + image-dimension extraction + asset-row creation.
 */
@Module({
  imports: [EntityEngineModule.forEntity(MEDIA_ASSETS_CONFIG)],
})
export class MediaLibraryModule {}
