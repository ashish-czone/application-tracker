import { Injectable } from '@nestjs/common';
import { DatabaseService, and, eq } from '@packages/database';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import { userPreferences } from '../schema/user-preferences';
import type { UserPreference } from '../types';

@Injectable()
export class UserPreferencesService {
  constructor(private readonly database: DatabaseService) {}

  async listForUser(userId: string, namespace?: string): Promise<UserPreference[]> {
    const filters = [eq(userPreferences.userId, userId)];
    if (namespace) {
      filters.push(eq(userPreferences.namespace, namespace));
    }

    const rows = await this.database.db
      .select()
      .from(userPreferences)
      .where(withTenant(userPreferences, and(...filters)));

    return rows as UserPreference[];
  }

  async getOne(userId: string, namespace: string, key: string): Promise<UserPreference | null> {
    const [row] = await this.database.db
      .select()
      .from(userPreferences)
      .where(withTenant(
        userPreferences,
        and(
          eq(userPreferences.userId, userId),
          eq(userPreferences.namespace, namespace),
          eq(userPreferences.key, key),
        ),
      ))
      .limit(1);

    return (row as UserPreference | undefined) ?? null;
  }

  async set(userId: string, namespace: string, key: string, value: unknown): Promise<UserPreference> {
    const existing = await this.getOne(userId, namespace, key);

    if (existing) {
      const [updated] = await this.database.db
        .update(userPreferences)
        .set({ value: value as object })
        .where(withTenant(userPreferences, eq(userPreferences.id, existing.id)))
        .returning();
      return updated as UserPreference;
    }

    const [inserted] = await this.database.db
      .insert(userPreferences)
      .values(withTenantInsert(userPreferences, {
        userId,
        namespace,
        key,
        value: value as object,
        updatedAt: new Date(),
      }))
      .returning();

    return inserted as UserPreference;
  }

  async delete(userId: string, namespace: string, key: string): Promise<void> {
    await this.database.db
      .delete(userPreferences)
      .where(withTenant(
        userPreferences,
        and(
          eq(userPreferences.userId, userId),
          eq(userPreferences.namespace, namespace),
          eq(userPreferences.key, key),
        ),
      ));
  }
}
