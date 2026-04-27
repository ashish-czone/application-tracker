import type { DynamicModule, Type } from '@nestjs/common';
import type { PackageMigrationName } from './migrations';

/**
 * An addon is the bundle of "everything an opt-in package contributes to an
 * app": a NestJS module to wire (optional, for library-shape packages that
 * ship classes only) and the migration name that produces its tables.
 *
 * Apps declare their addons in one place — `createAppModule({ addons: [...] })`
 * imports the modules, `runAppMigrations({ addons: [...] })` applies the
 * migrations. Importing the same array in both consumers means you cannot
 * import a module without its migration tagging along, which is the whole
 * point of this shape.
 *
 * `module` is a thunk on purpose: addon exports can be safely imported by
 * lightweight CLIs (the migrate script) without triggering the NestJS
 * decorator imports buried inside Module classes. The thunk is only invoked
 * by `createAppModule`, which is loaded only by the running app.
 *
 * For configurable addons (tenancy, tasks-with-options) export a factory
 * function that returns an Addon. For schema-only addons (org-units, where
 * the package ships classes and the app composes its own NestJS module),
 * omit `module` and let the app put its own wrapper in `extraImports`.
 */
export interface Addon {
  readonly module?: () => Type<unknown> | DynamicModule;
  readonly migration: PackageMigrationName;
}
