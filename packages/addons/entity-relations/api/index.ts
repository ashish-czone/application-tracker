import { EntityRelationsModule } from './entity-relations.module';

export { EntityRelationsModule };
export { MultiValueService } from './services/multi-value.service';
export { entityMultiValues } from './schema/entity-multi-values';

export const entityRelationsAddon = {
  module: EntityRelationsModule,
  migration: '@packages/entity-relations',
} as const;
