import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, eq, and, desc, count, gte, lte } from '@packages/database';
import type { PaginatedResponse } from '@packages/common';
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

    if (query.entityType) conditions.push(eq(auditLogs.entityType, query.entityType));
    if (query.entityId) conditions.push(eq(auditLogs.entityId, query.entityId));
    if (query.actorId) conditions.push(eq(auditLogs.actorId, query.actorId));
    if (query.eventName) conditions.push(eq(auditLogs.eventName, query.eventName));
    if (query.action) conditions.push(eq(auditLogs.action, query.action));
    if (query.fromDate) conditions.push(gte(auditLogs.occurredAt, new Date(query.fromDate)));
    if (query.toDate) conditions.push(lte(auditLogs.occurredAt, new Date(query.toDate)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

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

    return {
      data: data as AuditLogRecord[],
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
      .where(eq(auditLogs.id, id))
      .limit(1);

    if (!record) throw new NotFoundException('Audit log entry not found');
    return record as AuditLogRecord;
  }

  async getEntityHistory(
    entityType: string,
    entityId: string,
    query: { page?: number; limit?: number } = {},
  ): Promise<PaginatedResponse<AuditLogRecord>> {
    return this.list({ ...query, entityType, entityId });
  }
}
