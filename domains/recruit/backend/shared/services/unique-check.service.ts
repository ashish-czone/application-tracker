import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService, eq, and, ne, isNull } from '@packages/database';
import type { SQL } from '@packages/database';

interface UniqueFieldConfig {
  column: any;
  /** Optional additional where clause (e.g., soft-delete filter) */
  extraCondition?: SQL;
}

interface EntityConfig {
  table: any;
  fields: Record<string, UniqueFieldConfig>;
  /** Permission required to check this entity (e.g., 'users.read') */
  readPermission: string;
  /** Column used as primary key for excludeId */
  idColumn: any;
}

@Injectable()
export class UniqueCheckService {
  private readonly registry = new Map<string, EntityConfig>();

  constructor(private readonly database: DatabaseService) {}

  register(entity: string, config: EntityConfig) {
    this.registry.set(entity, config);
  }

  getPermission(entity: string): string | null {
    return this.registry.get(entity)?.readPermission ?? null;
  }

  async isUnique(entity: string, field: string, value: string, excludeId?: string): Promise<boolean> {
    const config = this.registry.get(entity);
    if (!config) throw new BadRequestException(`Unknown entity: ${entity}`);

    const fieldConfig = config.fields[field];
    if (!fieldConfig) throw new BadRequestException(`Field '${field}' is not a unique field on '${entity}'`);

    const conditions: SQL[] = [eq(fieldConfig.column, value)];

    if (excludeId) {
      conditions.push(ne(config.idColumn, excludeId));
    }

    if (fieldConfig.extraCondition) {
      conditions.push(fieldConfig.extraCondition);
    }

    const [result] = await this.database.db
      .select({ id: config.idColumn })
      .from(config.table)
      .where(and(...conditions))
      .limit(1);

    return !result;
  }
}
