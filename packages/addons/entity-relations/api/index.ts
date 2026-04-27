export { EntityRelationsModule } from './entity-relations.module';
export { MultiValueService } from './services/multi-value.service';
export { entityMultiValues } from './schema/entity-multi-values';

export const entityRelationsAddon = {
  module: () => require('./entity-relations.module').EntityRelationsModule,
  migration: '@packages/entity-relations',
} as const;
