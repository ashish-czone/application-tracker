import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool, PoolClient } from 'pg';
import type { DrizzleDB } from '@packages/database';

interface TenantConnection {
  client: PoolClient;
  db: DrizzleDB;
}

/**
 * Manages per-request dedicated connections for RLS mode.
 *
 * Lifecycle:
 * 1. On first DB access in a request: check out a PoolClient, run SET app.tenant_id
 * 2. All queries in the request use this connection
 * 3. On request end: RESET app.tenant_id, release client back to pool
 *
 * Connections are acquired lazily — if a request never touches the DB,
 * no connection is checked out.
 */
@Injectable()
export class RlsConnectionService implements OnModuleDestroy {
  private activeConnections = new Map<string, TenantConnection>();
  private schema: any;

  setSchema(schema: any) {
    this.schema = schema;
  }

  async acquireConnection(pool: Pool, tenantId: string, requestId: string): Promise<DrizzleDB> {
    const existing = this.activeConnections.get(requestId);
    if (existing) {
      return existing.db;
    }

    const client = await pool.connect();
    await client.query(`SELECT set_config('app.tenant_id', $1, false)`, [tenantId]);

    const db = drizzle(client, { schema: this.schema }) as unknown as DrizzleDB;

    this.activeConnections.set(requestId, { client, db });
    return db;
  }

  async releaseConnection(requestId: string): Promise<void> {
    const connection = this.activeConnections.get(requestId);
    if (!connection) return;

    try {
      await connection.client.query(`RESET app.tenant_id`);
    } finally {
      connection.client.release();
      this.activeConnections.delete(requestId);
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const [requestId] of this.activeConnections) {
      await this.releaseConnection(requestId);
    }
  }
}
