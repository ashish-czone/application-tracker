import { Injectable, OnModuleDestroy, Module, Global } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type DrizzleDB = NodePgDatabase<typeof schema>;

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  protected readonly pool: Pool;
  readonly db: DrizzleDB;

  constructor() {
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
    this.db = drizzle(this.pool, { schema });
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
export { eq, ne, and, or, not, gt, lt, gte, lte, isNull, isNotNull, ilike, like, sql, asc, desc, inArray, count } from 'drizzle-orm';
export type { SQL } from 'drizzle-orm';
