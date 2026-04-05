import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { DrizzleDB } from '@packages/database';

interface CachedPool {
  pool: Pool;
  db: DrizzleDB;
  lastAccess: number;
}

const DEFAULT_IDLE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const EVICTION_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes

/**
 * Manages a pool-per-tenant for database-per-tenant mode.
 *
 * Pools are created on first access and cached. Idle pools not accessed
 * within the TTL are automatically closed and evicted.
 */
@Injectable()
export class TenantPoolManager implements OnModuleDestroy {
  private pools = new Map<string, CachedPool>();
  private evictionTimer: ReturnType<typeof setInterval> | null = null;
  private schema: any;
  private idleTtlMs = DEFAULT_IDLE_TTL_MS;

  setSchema(schema: any) {
    this.schema = schema;
  }

  setIdleTtl(ms: number) {
    this.idleTtlMs = ms;
  }

  startEviction() {
    if (this.evictionTimer) return;
    this.evictionTimer = setInterval(() => this.evictIdle(), EVICTION_INTERVAL_MS);
  }

  getDrizzleForTenant(tenantId: string, databaseUrl: string): DrizzleDB {
    const existing = this.pools.get(tenantId);
    if (existing) {
      existing.lastAccess = Date.now();
      return existing.db;
    }

    const pool = new Pool({ connectionString: databaseUrl });
    const db = drizzle(pool, { schema: this.schema }) as unknown as DrizzleDB;

    this.pools.set(tenantId, { pool, db, lastAccess: Date.now() });
    return db;
  }

  private evictIdle() {
    const now = Date.now();
    for (const [tenantId, cached] of this.pools) {
      if (now - cached.lastAccess > this.idleTtlMs) {
        cached.pool.end().catch(() => {});
        this.pools.delete(tenantId);
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
    }
    const closePromises = Array.from(this.pools.values()).map((cached) =>
      cached.pool.end().catch(() => {}),
    );
    await Promise.all(closePromises);
    this.pools.clear();
  }
}
