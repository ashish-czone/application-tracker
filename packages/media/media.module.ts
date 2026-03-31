import { Module, type DynamicModule, type OnModuleInit, Optional, Inject } from '@nestjs/common';
import { FieldTypeSaveHookRegistry } from '@packages/entity-engine';
import { MediaService } from './services/media.service';
import { MediaUploadController } from './controllers/media-upload.controller';
import { MEDIA_MODULE_CONFIG, type MediaModuleConfig, type MediaModuleAsyncOptions, type MediaFile } from './types';

function isMediaFile(value: unknown): value is MediaFile {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as any).key === 'string' &&
    typeof (value as any).originalName === 'string'
  );
}

@Module({})
export class MediaModule implements OnModuleInit {
  constructor(
    private readonly mediaService: MediaService,
    @Optional() @Inject(FieldTypeSaveHookRegistry) private readonly hookRegistry?: FieldTypeSaveHookRegistry,
  ) {}

  onModuleInit() {
    if (!this.hookRegistry) return;

    this.hookRegistry.register('file', {
      onBeforeSave: async (value, ctx) => {
        if (isMediaFile(value) && value.key.startsWith('tmp/')) {
          const moved = await this.mediaService.moveFromTmp(
            value,
            ctx.entityType,
            ctx.entityId,
            ctx.fieldKey,
          );
          return { transformedValue: moved };
        }
        return {};
      },
    });
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
