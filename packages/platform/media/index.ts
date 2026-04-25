// Module, Service & Controller
export { MediaModule } from './media.module';
export { MediaService } from './services/media.service';
export { MediaUploadController } from './controllers/media-upload.controller';

// Field type
export { createFileFieldType, createMediaFieldTypesPlugin } from './file-field-type';

// Types
export type {
  MediaFile,
  MediaFieldConfig,
  UploadedFile,
  MediaModuleConfig,
  MediaModuleAsyncOptions,
} from './types';
export { MEDIA_MODULE_CONFIG, DEFAULT_MAX_FILE_SIZE } from './types';

// Provider interface
export type { MediaProvider } from './providers/media-provider.interface';

// Helpers
export {
  isMimeTypeAccepted,
  isFileSizeValid,
  getExtension,
  generateStorageKey,
  generateTmpKey,
} from './helpers/validation';
