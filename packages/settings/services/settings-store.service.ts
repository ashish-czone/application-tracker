import { Injectable, type OnModuleInit } from '@nestjs/common';
import { DatabaseService, eq, and } from '@packages/database';
import { settings } from '../schema';

@Injectable()
export class SettingsStoreService implements OnModuleInit {
  private cache = new Map<string, Map<string, unknown>>();

  constructor(private readonly database: DatabaseService) {}

  async onModuleInit() {
    await this.loadAll();
  }

  async loadAll() {
    const rows = await this.database.db.select().from(settings);

    this.cache.clear();
    for (const row of rows) {
      if (!this.cache.has(row.module)) {
        this.cache.set(row.module, new Map());
      }
      this.cache.get(row.module)!.set(row.key, row.value);
    }
  }

  getCached(module: string, key: string): unknown | undefined {
    return this.cache.get(module)?.get(key);
  }

  getAllCachedByModule(module: string): Record<string, unknown> {
    const moduleCache = this.cache.get(module);
    if (!moduleCache) return {};

    const result: Record<string, unknown> = {};
    for (const [key, value] of moduleCache) {
      result[key] = value;
    }
    return result;
  }

  async upsert(module: string, key: string, value: unknown, updatedBy: string) {
    const [existing] = await this.database.db
      .select()
      .from(settings)
      .where(and(eq(settings.module, module), eq(settings.key, key)))
      .limit(1);

    if (existing) {
      await this.database.db
        .update(settings)
        .set({ value, updatedBy })
        .where(eq(settings.id, existing.id));
    } else {
      await this.database.db
        .insert(settings)
        .values({ module, key, value, updatedBy });
    }

    // Update cache
    if (!this.cache.has(module)) {
      this.cache.set(module, new Map());
    }
    this.cache.get(module)!.set(key, value);
  }

  async remove(module: string, key: string) {
    await this.database.db
      .delete(settings)
      .where(and(eq(settings.module, module), eq(settings.key, key)));

    // Update cache
    this.cache.get(module)?.delete(key);
  }
}
