import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '@packages/database';
import { tenants } from '../schema/tenants';
import type { TenantInfo, TenantLookup } from '../types';

/**
 * CRUD service for the tenants control-plane table.
 *
 * In database-per-tenant mode, this queries the control-plane DB
 * (the main DB where the tenants table lives) to resolve tenant
 * connection info.
 *
 * In RLS mode, this is used for tenant management (create/list/update tenants)
 * but not for connection routing.
 */
@Injectable()
export class TenantRegistryService implements TenantLookup {
  constructor(private readonly database: DatabaseService) {}

  async findBySlug(slug: string): Promise<TenantInfo | null> {
    const [row] = await this.database.db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);

    return row ? this.toTenantInfo(row) : null;
  }

  async findById(id: string): Promise<TenantInfo | null> {
    const [row] = await this.database.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);

    return row ? this.toTenantInfo(row) : null;
  }

  async list(): Promise<TenantInfo[]> {
    const rows = await this.database.db.select().from(tenants);
    return rows.map(this.toTenantInfo);
  }

  async listByStatus(status: 'active' | 'suspended' | 'provisioning'): Promise<TenantInfo[]> {
    const rows = await this.database.db
      .select()
      .from(tenants)
      .where(eq(tenants.status, status));
    return rows.map(this.toTenantInfo);
  }

  async create(data: {
    slug: string;
    name: string;
    databaseUrl: string;
    plan?: string;
    capabilities?: string[];
    planExpiry?: string;
    clientId?: string;
  }): Promise<TenantInfo> {
    const [row] = await this.database.db
      .insert(tenants)
      .values(data)
      .returning();

    return this.toTenantInfo(row);
  }

  async update(id: string, data: Partial<{
    name: string;
    slug: string;
    databaseUrl: string;
    status: 'active' | 'suspended' | 'provisioning';
    plan: string;
    capabilities: string[];
    planExpiry: string;
    clientId: string;
  }>): Promise<TenantInfo> {
    const [row] = await this.database.db
      .update(tenants)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();

    return this.toTenantInfo(row);
  }

  async updateStatus(id: string, status: TenantInfo['status']): Promise<void> {
    await this.database.db
      .update(tenants)
      .set({ status, updatedAt: new Date() })
      .where(eq(tenants.id, id));
  }

  private toTenantInfo(row: typeof tenants.$inferSelect): TenantInfo {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      databaseUrl: row.databaseUrl,
      status: row.status as TenantInfo['status'],
      plan: row.plan ?? undefined,
      capabilities: row.capabilities ?? undefined,
      planExpiry: row.planExpiry ?? undefined,
      clientId: row.clientId ?? undefined,
    };
  }
}
