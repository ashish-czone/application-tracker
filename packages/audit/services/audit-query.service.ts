import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, eq, and, or, desc, count, gte, lte, sql } from '@packages/database';
import type { PaginatedResponse } from '@packages/common';
import { withTenant, tenantCondition } from '@packages/tenancy/helpers';
import { auditLogs } from '../schema';
import type { AuditLogRecord, ListAuditLogsQuery } from '../types';

@Injectable()
export class AuditQueryService {
  constructor(private readonly database: DatabaseService) {}

  async list(query: ListAuditLogsQuery = {}): Promise<PaginatedResponse<AuditLogRecord>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [];
    const sharedConditions: ReturnType<typeof eq>[] = [];

    if (query.actorId) sharedConditions.push(eq(auditLogs.actorId, query.actorId));
    if (query.eventName) sharedConditions.push(eq(auditLogs.eventName, query.eventName));
    if (query.action) sharedConditions.push(eq(auditLogs.action, query.action));
    if (query.fromDate) sharedConditions.push(gte(auditLogs.occurredAt, new Date(query.fromDate)));
    if (query.toDate) sharedConditions.push(lte(auditLogs.occurredAt, new Date(query.toDate)));

    if (query.includeRelated && query.entityType && query.entityId) {
      // Activity mode: direct changes OR related cross-entity events
      conditions.push(or(
        and(eq(auditLogs.entityType, query.entityType), eq(auditLogs.entityId, query.entityId)),
        and(eq(auditLogs.targetEntityType, query.entityType), eq(auditLogs.targetEntityId, query.entityId)),
      )!);
    } else {
      if (query.entityType) conditions.push(eq(auditLogs.entityType, query.entityType));
      if (query.entityId) conditions.push(eq(auditLogs.entityId, query.entityId));
      if (query.targetEntityType) conditions.push(eq(auditLogs.targetEntityType, query.targetEntityType));
      if (query.targetEntityId) conditions.push(eq(auditLogs.targetEntityId, query.targetEntityId));
    }

    const allConditions = [...conditions, ...sharedConditions];
    const where = withTenant(auditLogs, ...(allConditions.length > 0 ? [and(...allConditions)] : []));

    const [data, [{ total }]] = await Promise.all([
      this.database.db
        .select()
        .from(auditLogs)
        .where(where)
        .orderBy(desc(auditLogs.occurredAt))
        .limit(limit)
        .offset(offset),
      this.database.db
        .select({ total: count() })
        .from(auditLogs)
        .where(where),
    ]);

    // Resolve actor names
    const records = await this.resolveActorNames(data as AuditLogRecord[]);

    return {
      data: records,
      meta: {
        total: Number(total),
        page,
        limit,
        totalPages: Math.ceil(Number(total) / limit),
      },
    };
  }

  async findOneOrFail(id: string): Promise<AuditLogRecord> {
    const [record] = await this.database.db
      .select()
      .from(auditLogs)
      .where(withTenant(auditLogs, eq(auditLogs.id, id)))
      .limit(1);

    if (!record) throw new NotFoundException('Audit log entry not found');

    const [resolved] = await this.resolveActorNames([record as AuditLogRecord]);
    return resolved;
  }

  async getEntityHistory(
    entityType: string,
    entityId: string,
    query: { page?: number; limit?: number } = {},
  ): Promise<PaginatedResponse<AuditLogRecord>> {
    return this.list({ ...query, entityType, entityId });
  }

  private async resolveActorNames(records: AuditLogRecord[]): Promise<AuditLogRecord[]> {
    const actorIds = [...new Set(records.map(r => r.actorId).filter(Boolean))] as string[];
    if (actorIds.length === 0) return records;

    const users = await this.database.db
      .select({ id: sql`id`, firstName: sql`first_name`, lastName: sql`last_name` })
      .from(sql`users`)
      .where(sql`id IN (${sql.join(actorIds.map(id => sql`${id}`), sql`, `)}) AND ${tenantCondition()}`) as { id: string; firstName: string; lastName: string }[];

    const nameMap = new Map<string, string>();
    for (const u of users) {
      nameMap.set(u.id, `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim());
    }

    return records.map(r => ({
      ...r,
      actorName: r.actorId ? nameMap.get(r.actorId) ?? null : null,
    }));
  }
}
