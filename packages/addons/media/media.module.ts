import { Module, type DynamicModule, type OnModuleInit } from '@nestjs/common';
import { fieldTypeRegistry } from '@packages/field-types';
import { MediaService } from './services/media.service';
import { MediaUploadController } from './controllers/media-upload.controller';
import { createMediaFieldTypesPlugin } from './file-field-type';
import { MEDIA_MODULE_CONFIG, type MediaModuleConfig, type MediaModuleAsyncOptions } from './types';

@Module({})
export class MediaModule implements OnModuleInit {
  constructor(private readonly mediaService: MediaService) {}

  onModuleInit() {
    if (!fieldTypeRegistry.has('file')) {
      fieldTypeRegistry.registerPlugin(createMediaFieldTypesPlugin(this.mediaService));
    }
  }

  static register(config: MediaModuleConfig): DynamicModule {
    return {
      module: MediaModule,
      global: true,
      controllers: [MediaUploadController],
      providers: [
        { provide: MEDIA_MODULE_CONFIG, useValue: config },
        MediaService,
      ],
      exports: [MediaService],
    };
  }

  static registerAsync(options: MediaModuleAsyncOptions): DynamicModule {
    return {
      module: MediaModule,
      global: true,
      controllers: [MediaUploadController],
      providers: [
        {
          provide: MEDIA_MODULE_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        MediaService,
      ],
      exports: [MediaService],
    };
  }
}
