import { Injectable } from '@nestjs/common';
import { DatabaseService, eq, and } from '@packages/database';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import { drafts } from '../schema/drafts';
import type { Draft } from '../types';

@Injectable()
export class DraftsService {
  constructor(private readonly database: DatabaseService) {}

  async save(data: {
    entityType: string;
    draftKey: string;
    data: unknown;
    createdById: string;
  }): Promise<Draft> {
    const existing = await this.find(data.entityType, data.draftKey, data.createdById);

    if (existing) {
      const [updated] = await this.database.db
        .update(drafts)
        .set({ data: data.data })
        .where(withTenant(drafts, eq(drafts.id, existing.id)))
        .returning();
      return updated;
    }

    const [created] = await this.database.db
      .insert(drafts)
      .values(withTenantInsert(drafts, {
        entityType: data.entityType,
        draftKey: data.draftKey,
        data: data.data,
        createdById: data.createdById,
        updatedAt: new Date(),
      }))
      .returning();
    return created;
  }

  async find(entityType: string, draftKey: string, userId: string): Promise<Draft | null> {
    const [row] = await this.database.db
      .select()
      .from(drafts)
      .where(withTenant(drafts,
        eq(drafts.entityType, entityType),
        eq(drafts.draftKey, draftKey),
        eq(drafts.createdById, userId),
      ))
      .limit(1);

    return row ?? null;
  }

  async delete(entityType: string, draftKey: string, userId: string): Promise<void> {
    await this.database.db
      .delete(drafts)
      .where(withTenant(drafts,
        eq(drafts.entityType, entityType),
        eq(drafts.draftKey, draftKey),
        eq(drafts.createdById, userId),
      ));
  }

  async listForUser(userId: string, entityType?: string): Promise<Draft[]> {
    const conditions = [eq(drafts.createdById, userId)];
    if (entityType) {
      conditions.push(eq(drafts.entityType, entityType));
    }

    return this.database.db
      .select()
      .from(drafts)
      .where(withTenant(drafts, ...conditions));
  }
}
