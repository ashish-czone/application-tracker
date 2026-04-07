/**
 * Registers the `rating` field type UI definition.
 * Import and call registerRatingFieldType() at app startup
 * alongside eav-attributes-ui/register-all and entity-relations-ui registration.
 */
import { z } from 'zod';
import { fieldTypeUIRegistry } from '@packages/field-types/ui';
import { StarRating } from '../components/StarRating';
import { FormRatingInput } from '../components/FormRatingInput';

function ratingView({ value }: { value: unknown }) {
  return <StarRating value={value as number} />;
}

function ratingCell({ value }: { value: unknown }) {
  return <StarRating value={value as number} size="sm" />;
}

export function registerRatingFieldType() {
  fieldTypeUIRegistry.registerAll([
    {
      type: 'rating',
      FormComponent: FormRatingInput,
      ViewComponent: ratingView,
      CellFormatter: ratingCell,
      zodSchema: z.coerce.number().int().min(1).max(5),
    },
  ]);
}
