import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  // The other schema files here are backward-compatibility re-exports of
  // tables owned by @packages/entity-engine and @packages/entity-layout;
  // only entity_field_values is actually owned by this package.
  schema: './schema/entity-field-values.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://placeholder',
  },
});
