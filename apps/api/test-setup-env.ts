/**
 * Vitest setup file for app-level e2e tests.
 * Sets required env vars before AppModule loads ConfigModule.
 */
process.env.DATABASE_URL ??= 'postgresql://dev:dev@localhost:5432/starter';
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.JWT_SECRET ??= 'test-jwt-secret-for-e2e';
process.env.NODE_ENV ??= 'test';
process.env.ALLOWED_ORIGINS ??= 'http://localhost:5174';
process.env.MEDIA_PROVIDER ??= 'local';
process.env.MEDIA_LOCAL_PATH ??= '/tmp/e2e-uploads';
process.env.MEDIA_BASE_URL ??= 'http://localhost:3012/uploads';
process.env.APP_TIMEZONE ??= 'UTC';
