import { Module, type DynamicModule } from '@nestjs/common';
import { MediaService } from './services/media.service';
import { MediaUploadController } from './controllers/media-upload.controller';
import { MEDIA_MODULE_CONFIG, type MediaModuleConfig, type MediaModuleAsyncOptions } from './types';

@Module({})
export class MediaModule {
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
