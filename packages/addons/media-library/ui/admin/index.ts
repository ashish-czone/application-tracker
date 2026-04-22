export { MediaLibraryPage } from './MediaLibraryPage';
export { MediaAssetCard } from './MediaAssetCard';
export { MediaAssetDrawer } from './MediaAssetDrawer';

export { registerMediaLibraryFieldTypes } from './field-types/register';
export { MediaPickerDialog } from './field-types/MediaPickerDialog';

export { createMediaAssetsApi } from './services';
export type { MediaAssetsApi } from './services';

export {
  useMediaAssets,
  useMediaAsset,
  useUpdateMediaAsset,
  useDeleteMediaAsset,
  useUploadMediaAsset,
} from './hooks';

export type {
  MediaAssetRecord,
  UpdateMediaAssetInput,
  UploadMediaAssetInput,
  Paginated,
} from './types';
