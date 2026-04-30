import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, eq, and, isNull, ilike, asc, desc, sql, count } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import {
  marketingMonitoringSources,
  type MarketingMonitoringSourceRow,
} from './schema/sources';
import type { CreateMonitoringSourceInput } from './dto/create-source.dto';
import type { UpdateMonitoringSourceInput } from './dto/update-source.dto';
import type { ListMonitoringSourcesQuery } from './dto/list-sources-query.dto';
import { PollerSchedulerService } from './poller-scheduler.service';
import {
  MARKETING_MONITORING_SOURCE_REGISTERED,
  MARKETING_MONITORING_SOURCE_UPDATED,
  MARKETING_MONITORING_SOURCE_REMOVED,
  type MarketingMonitoringSourceRegisteredPayload,
  type MarketingMonitoringSourceUpdatedPayload,
  type MarketingMonitoringSourceRemovedPayload,
} from './events/types';

export interface PaginatedResult<T> {
  data: T[];
  meta: { page: number; limit: number; total: number };
}

@Injectable()
export class MonitoringSourcesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly events: DomainEventEmitter,
    private readonly scheduler: PollerSchedulerService,
  ) {}

  async list(query: ListMonitoringSourcesQuery): Promise<PaginatedResult<MarketingMonitoringSourceRow>> {
    const { page, limit, kind, isActive, q, sort } = query;
    const offset = (page - 1) * limit;

    const conditions = [isNull(marketingMonitoringSources.deletedAt)];
    if (kind) conditions.push(eq(marketingMonitoringSources.kind, kind));
    if (isActive !== undefined) conditions.push(eq(marketingMonitoringSources.isActive, isActive));
    if (q) conditions.push(ilike(marketingMonitoringSources.label, `%${q}%`));

    const where = and(...conditions);

    const orderBy = (() => {
      const desc_ = sort.startsWith('-');
      const field = desc_ ? sort.slice(1) : sort;
      const direction = desc_ ? desc : asc;
      switch (field) {
        case 'label':
          return direction(marketingMonitoringSources.label);
        case 'lastFetchedAt':
          return direction(marketingMonitoringSources.lastFetchedAt);
        case 'createdAt':
        default:
          return direction(marketingMonitoringSources.createdAt);
      }
    })();

    const [rows, [{ value: total }]] = await Promise.all([
      this.database.db
        .select()
        .from(marketingMonitoringSources)
        .where(where)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
      this.database.db
        .select({ value: count() })
        .from(marketingMonitoringSources)
        .where(where),
    ]);

    return { data: rows, meta: { page, limit, total: Number(total) } };
  }

  async findOne(id: string): Promise<MarketingMonitoringSourceRow> {
    const [row] = await this.database.db
      .select()
      .from(marketingMonitoringSources)
      .where(
        and(
          eq(marketingMonitoringSources.id, id),
          isNull(marketingMonitoringSources.deletedAt),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException(`Monitoring source ${id} not found`);
    }
    return row;
  }

  async create(input: CreateMonitoringSourceInput, actorId: string): Promise<MarketingMonitoringSourceRow> {
    const [row] = await this.database.db
      .insert(marketingMonitoringSources)
      .values({
        kind: input.kind,
        label: input.label,
        configJson: input.config,
        pollingCadenceMinutes: input.pollingCadenceMinutes,
        isActive: input.isActive,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    this.events.emit(MARKETING_MONITORING_SOURCE_REGISTERED, {
      entityType: 'marketing.monitoring-sources',
      entityId: row.id,
      actorId,
      payload: {
        sourceId: row.id,
        kind: row.kind,
        label: row.label,
        pollingCadenceMinutes: row.pollingCadenceMinutes,
      } satisfies MarketingMonitoringSourceRegisteredPayload,
    });

    await this.scheduler.upsertSchedule(row);

    return row;
  }

  async update(
    id: string,
    input: UpdateMonitoringSourceInput,
    actorId: string,
  ): Promise<MarketingMonitoringSourceRow> {
    const existing = await this.findOne(id);

    const updates: Partial<typeof marketingMonitoringSources.$inferInsert> = {
      updatedBy: actorId,
    };
    if (input.label !== undefined) updates.label = input.label;
    if (input.config !== undefined) updates.configJson = input.config;
    if (input.pollingCadenceMinutes !== undefined)
      updates.pollingCadenceMinutes = input.pollingCadenceMinutes;
    if (input.isActive !== undefined) updates.isActive = input.isActive;

    const [row] = await this.database.db
      .update(marketingMonitoringSources)
      .set(updates)
      .where(eq(marketingMonitoringSources.id, id))
      .returning();

    this.events.emit(MARKETING_MONITORING_SOURCE_UPDATED, {
      entityType: 'marketing.monitoring-sources',
      entityId: row.id,
      actorId,
      payload: {
        sourceId: row.id,
        changes: diffShape(existing, row),
      } satisfies MarketingMonitoringSourceUpdatedPayload,
    });

    // upsertSchedule is idempotent and routes inactive sources to remove.
    await this.scheduler.upsertSchedule(row);

    return row;
  }

  async softDelete(id: string, actorId: string): Promise<void> {
    const existing = await this.findOne(id);

    await this.database.db
      .update(marketingMonitoringSources)
      .set({
        deletedAt: new Date(),
        deletedBy: actorId,
        isActive: false,
      })
      .where(eq(marketingMonitoringSources.id, id));

    this.events.emit(MARKETING_MONITORING_SOURCE_REMOVED, {
      entityType: 'marketing.monitoring-sources',
      entityId: id,
      actorId,
      payload: {
        sourceId: id,
        kind: existing.kind,
        label: existing.label,
      } satisfies MarketingMonitoringSourceRemovedPayload,
    });

    await this.scheduler.removeSchedule(id, existing.kind);
  }

  /**
   * Stamp a successful poll. Called by the per-kind poller jobs in
   * monitoring/sources/jobs/. Does not emit a domain event — polls are
   * not domain-meaningful, only operational.
   */
  async recordPollSuccess(id: string): Promise<void> {
    await this.database.db
      .update(marketingMonitoringSources)
      .set({ lastFetchedAt: new Date(), lastError: null })
      .where(eq(marketingMonitoringSources.id, id));
  }

  /**
   * Stamp a failed poll attempt. Called by per-kind poller jobs. Does
   * not change isActive — the operator decides when to disable.
   */
  async recordPollError(id: string, errorMessage: string): Promise<void> {
    await this.database.db
      .update(marketingMonitoringSources)
      .set({ lastFetchedAt: new Date(), lastError: errorMessage.slice(0, 4000) })
      .where(eq(marketingMonitoringSources.id, id));
  }

  async listActive(): Promise<MarketingMonitoringSourceRow[]> {
    return this.database.db
      .select()
      .from(marketingMonitoringSources)
      .where(
        and(
          eq(marketingMonitoringSources.isActive, true),
          isNull(marketingMonitoringSources.deletedAt),
        ),
      );
  }
}

function diffShape(
  before: MarketingMonitoringSourceRow,
  after: MarketingMonitoringSourceRow,
): Record<string, unknown> {
  const diff: Record<string, unknown> = {};
  for (const key of Object.keys(after) as (keyof MarketingMonitoringSourceRow)[]) {
    if (key === 'updatedAt' || key === 'updatedBy') continue;
    if (before[key] !== after[key]) {
      diff[key] = { before: before[key], after: after[key] };
    }
  }
  return diff;
}
