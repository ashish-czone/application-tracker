import { Injectable, OnModuleDestroy, Module, Global } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type DrizzleDB = NodePgDatabase<typeof schema>;
export type DrizzleTx = Parameters<Parameters<DrizzleDB['transaction']>[0]>[0];

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  protected readonly pool: Pool;
  private readonly _db: DrizzleDB;

  get db(): DrizzleDB {
    return this._db;
  }

  /** Returns the underlying pg pool. Intended for instrumentation (e.g. debug-profiler). */
  getPool(): Pool {
    return this.pool;
  }

  constructor() {
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
    this._db = drizzle(this.pool, { schema });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}

@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}

// Re-export schema tables and types for use by services
export * from './schema';

// Re-export commonly used drizzle operators
export { eq, ne, and, or, not, gt, lt, gte, lte, isNull, isNotNull, ilike, like, sql, asc, desc, inArray, count, avg, sum, min, max } from 'drizzle-orm';
export type { SQL } from 'drizzle-orm';

// Migration runner (used by apps' db:migrate CLI)
export {
  runMigrations,
  migrationsTableFor,
  type PackageMigrationSource,
  type RunMigrationsOptions,
} from './migrator';

// Row-level scope helpers (mandatory per .claude/rules/data-scoping.md)
export { withScope, withScopeIncludingDeleted, tenantSqlCondition } from './scope';
