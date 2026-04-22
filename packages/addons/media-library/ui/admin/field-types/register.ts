/**
 * Registers the `media` UI field type. Import this from the app's main.tsx
 * alongside the other field-type registrations so forms, detail views, and
 * data grids can render media pickers/thumbnails.
 */
import { fieldTypeUIRegistry, zodSchemas } from '@packages/field-types/ui';
import { MediaPickerForm } from './MediaPickerForm';
import { MediaView, mediaCell } from './MediaView';

export function registerMediaLibraryFieldTypes() {
  fieldTypeUIRegistry.register({
    type: 'media',
    FormComponent: MediaPickerForm,
    ViewComponent: MediaView,
    CellFormatter: mediaCell,
    zodSchema: zodSchemas.uuidSchema,
  });
}
