import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: [
    './applications/schema',
    './candidates/schema',
    './clients/schema',
    './contacts/schema',
    './interviews/schema',
    './job-openings/schema',
    './offers/schema',
    './vendors/schema',
  ],
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://placeholder',
  },
});
