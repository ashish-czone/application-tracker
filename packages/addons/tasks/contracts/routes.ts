import { buildEntityRoutes } from '@packages/entity-engine-contract';

/**
 * HTTP routes exposed by @packages/tasks. Generated from the entity slug,
 * same paths as `createEntityController` produces on the api side.
 */
export const tasksRoutes = buildEntityRoutes('tasks');
