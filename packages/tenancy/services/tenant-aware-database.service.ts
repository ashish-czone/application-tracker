import { Injectable, Inject, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { PoolClient } from 'pg';
import { DatabaseService, type DrizzleDB } from '@packages/database';
import { getCorrelationId, getTenantId } from '@packages/logger';
import { TENANCY_CONFIG, type TenancyConfig } from '../types';
import { TenantPoolManager } from './tenant-pool-manager.service';
import { TenantRegistryService } from './tenant-registry.service';
import * as schema from '@packages/database/schema';

interface RlsRequestContext {
  client: PoolClient;
  db: DrizzleDB;
}

/**
 * Replaces DatabaseService in DI when TenancyModule is loaded.
 *
 * Provides a `db` getter that returns the correct Drizzle instance
 * based on the current tenancy mode and request context:
 *
 * - No tenant context → returns global (control-plane) db
 * - RLS mode → returns request-scoped Drizzle from a dedicated PoolClient
 *   with SET app.tenant_id already executed
 * - Database mode → returns Drizzle from the tenant's own pool
 *
 * The async acquisition is done by `acquireForRequest()` which the
 * tenancy middleware calls before any handler code runs. The sync `db`
 * getter then reads from the pre-acquired per-request Map.
 */
@Injectable()
export class TenantAwareDatabaseService extends DatabaseService implements OnModuleInit, OnModuleDestroy {
  private rlsConnections = new Map<string, RlsRequestContext>();

  constructor(
    @Inject(TENANCY_CONFIG) private readonly tenancyConfig: TenancyConfig,
    private readonly poolManager: TenantPoolManager,
    private readonly tenantRegistry: TenantRegistryService,
  ) {
    super();
    this.poolManager.setSchema(schema);
  }

  onModuleInit() {
    if (this.tenancyConfig.mode === 'database') {
      this.poolManager.startEviction();
    }
  }

  override get db(): DrizzleDB {
    const tenantId = getTenantId();

    if (!tenantId) {
      return super.db;
    }

    if (this.tenancyConfig.mode === 'rls') {
      const requestId = getCorrelationId();
      const ctx = this.rlsConnections.get(requestId);
      if (ctx) return ctx.db;
      // If no pre-acquired connection, fall back to global db.
      // RLS policies on the global pool will still enforce isolation
      // if SET was done at the pool connection level.
      return super.db;
    }

    // Database mode: pool manager has sync access to cached pools.
    // The tenant's databaseUrl must have been pre-resolved by middleware.
    const requestId = getCorrelationId();
    const ctx = this.rlsConnections.get(requestId);
    if (ctx) return ctx.db;
    return super.db;
  }

  /**
   * Called by tenancy middleware before the request handler.
   * Acquires the tenant-scoped DB connection asynchronously.
   */
  async acquireForRequest(tenantId: string, requestId: string): Promise<void> {
    if (this.tenancyConfig.mode === 'rls') {
      await this.acquireRlsConnection(tenantId, requestId);
    } else {
      await this.acquireDatabaseConnection(tenantId, requestId);
    }
  }

  /**
   * Called by tenancy middleware on response end.
   * Releases the tenant-scoped DB connection.
   */
  async releaseForRequest(requestId: string): Promise<void> {
    const ctx = this.rlsConnections.get(requestId);
    if (!ctx) return;

    if (this.tenancyConfig.mode === 'rls') {
      try {
        await ctx.client.query('RESET app.tenant_id');
      } finally {
        ctx.client.release();
      }
    }

    this.rlsConnections.delete(requestId);
  }

  private async acquireRlsConnection(tenantId: string, requestId: string): Promise<void> {
    const client = await this.pool.connect();
    await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [tenantId]);
    const db = drizzle(client, { schema }) as unknown as DrizzleDB;
    this.rlsConnections.set(requestId, { client, db });
  }

  private async acquireDatabaseConnection(tenantId: string, requestId: string): Promise<void> {
    const tenant = await this.tenantRegistry.findById(tenantId);
    if (!tenant) return;
    const db = this.poolManager.getDrizzleForTenant(tenantId, tenant.databaseUrl);
    // In database mode, we don't check out a dedicated client —
    // the pool manager handles connection pooling per-tenant.
    // We store the db reference so the getter can find it.
    this.rlsConnections.set(requestId, { client: null as any, db });
  }

  override async onModuleDestroy(): Promise<void> {
    // Release any lingering RLS connections
    for (const [requestId] of this.rlsConnections) {
      await this.releaseForRequest(requestId);
    }
    await super.onModuleDestroy();
  }
}
