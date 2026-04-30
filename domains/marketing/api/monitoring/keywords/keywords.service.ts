import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService, eq, and, isNull, ilike, asc, desc, count } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { marketingMonitoringKeywords, type MarketingMonitoringKeywordRow } from './schema/keywords';
import { marketingMonitoringSources } from '../sources/schema/sources';
import type { CreateMonitoringKeywordInput } from './dto/create-keyword.dto';
import type { UpdateMonitoringKeywordInput } from './dto/update-keyword.dto';
import type { ListMonitoringKeywordsQuery } from './dto/list-keywords-query.dto';
import {
  MARKETING_MONITORING_KEYWORD_REGISTERED,
  MARKETING_MONITORING_KEYWORD_UPDATED,
  MARKETING_MONITORING_KEYWORD_REMOVED,
  type MarketingMonitoringKeywordRegisteredPayload,
  type MarketingMonitoringKeywordUpdatedPayload,
  type MarketingMonitoringKeywordRemovedPayload,
} from './events/types';

export interface PaginatedResult<T> {
  data: T[];
  meta: { page: number; limit: number; total: number };
}

@Injectable()
export class MonitoringKeywordsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly events: DomainEventEmitter,
  ) {}

  async list(
    query: ListMonitoringKeywordsQuery,
  ): Promise<PaginatedResult<MarketingMonitoringKeywordRow>> {
    const { page, limit, sourceId, isActive, q, sort } = query;
    const offset = (page - 1) * limit;

    const conditions = [isNull(marketingMonitoringKeywords.deletedAt)];
    if (sourceId) conditions.push(eq(marketingMonitoringKeywords.sourceId, sourceId));
    if (isActive !== undefined) conditions.push(eq(marketingMonitoringKeywords.isActive, isActive));
    if (q) conditions.push(ilike(marketingMonitoringKeywords.phrase, `%${q}%`));

    const where = and(...conditions);

    const orderBy = (() => {
      const desc_ = sort.startsWith('-');
      const field = desc_ ? sort.slice(1) : sort;
      const direction = desc_ ? desc : asc;
      switch (field) {
        case 'phrase':
          return direction(marketingMonitoringKeywords.phrase);
        case 'createdAt':
        default:
          return direction(marketingMonitoringKeywords.createdAt);
      }
    })();

    const [rows, [{ value: total }]] = await Promise.all([
      this.database.db
        .select()
        .from(marketingMonitoringKeywords)
        .where(where)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
      this.database.db
        .select({ value: count() })
        .from(marketingMonitoringKeywords)
        .where(where),
    ]);

    return { data: rows, meta: { page, limit, total: Number(total) } };
  }

  async findOne(id: string): Promise<MarketingMonitoringKeywordRow> {
    const [row] = await this.database.db
      .select()
      .from(marketingMonitoringKeywords)
      .where(
        and(
          eq(marketingMonitoringKeywords.id, id),
          isNull(marketingMonitoringKeywords.deletedAt),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException(`Monitoring keyword ${id} not found`);
    }
    return row;
  }

  async create(
    input: CreateMonitoringKeywordInput,
    actorId: string,
  ): Promise<MarketingMonitoringKeywordRow> {
    await this.assertSourceExists(input.sourceId);

    const [row] = await this.database.db
      .insert(marketingMonitoringKeywords)
      .values({
        sourceId: input.sourceId,
        phrase: input.phrase,
        isRegex: input.isRegex,
        isActive: input.isActive,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();

    this.events.emit(MARKETING_MONITORING_KEYWORD_REGISTERED, {
      entityType: 'marketing.monitoring-keywords',
      entityId: row.id,
      actorId,
      payload: {
        keywordId: row.id,
        sourceId: row.sourceId,
        phrase: row.phrase,
        isRegex: row.isRegex,
      } satisfies MarketingMonitoringKeywordRegisteredPayload,
    });

    return row;
  }

  async update(
    id: string,
    input: UpdateMonitoringKeywordInput,
    actorId: string,
  ): Promise<MarketingMonitoringKeywordRow> {
    const existing = await this.findOne(id);

    const updates: Partial<typeof marketingMonitoringKeywords.$inferInsert> = {
      updatedBy: actorId,
    };
    if (input.phrase !== undefined) updates.phrase = input.phrase;
    if (input.isRegex !== undefined) updates.isRegex = input.isRegex;
    if (input.isActive !== undefined) updates.isActive = input.isActive;

    const [row] = await this.database.db
      .update(marketingMonitoringKeywords)
      .set(updates)
      .where(eq(marketingMonitoringKeywords.id, id))
      .returning();

    this.events.emit(MARKETING_MONITORING_KEYWORD_UPDATED, {
      entityType: 'marketing.monitoring-keywords',
      entityId: row.id,
      actorId,
      payload: {
        keywordId: row.id,
        sourceId: row.sourceId,
        changes: diffShape(existing, row),
      } satisfies MarketingMonitoringKeywordUpdatedPayload,
    });

    return row;
  }

  async softDelete(id: string, actorId: string): Promise<void> {
    const existing = await this.findOne(id);

    await this.database.db
      .update(marketingMonitoringKeywords)
      .set({ deletedAt: new Date(), deletedBy: actorId, isActive: false })
      .where(eq(marketingMonitoringKeywords.id, id));

    this.events.emit(MARKETING_MONITORING_KEYWORD_REMOVED, {
      entityType: 'marketing.monitoring-keywords',
      entityId: id,
      actorId,
      payload: {
        keywordId: id,
        sourceId: existing.sourceId,
        phrase: existing.phrase,
      } satisfies MarketingMonitoringKeywordRemovedPayload,
    });
  }

  /**
   * Returns active keywords for a source, used by the ingestion pipeline
   * (M1.3) to decide which incoming items match.
   */
  async listActiveForSource(sourceId: string): Promise<MarketingMonitoringKeywordRow[]> {
    return this.database.db
      .select()
      .from(marketingMonitoringKeywords)
      .where(
        and(
          eq(marketingMonitoringKeywords.sourceId, sourceId),
          eq(marketingMonitoringKeywords.isActive, true),
          isNull(marketingMonitoringKeywords.deletedAt),
        ),
      );
  }

  /**
   * Pure-function matcher used by ingestion (M1.3). Substring match by
   * default; regex match when keyword.isRegex is true. Case-insensitive
   * for both. Invalid regex never throws — it just returns false (the
   * create/update DTOs already validate, so this is a safety net).
   */
  matches(keyword: { phrase: string; isRegex: boolean }, text: string): boolean {
    if (!text) return false;
    if (keyword.isRegex) {
      try {
        return new RegExp(keyword.phrase, 'i').test(text);
      } catch {
        return false;
      }
    }
    return text.toLowerCase().includes(keyword.phrase.toLowerCase());
  }

  private async assertSourceExists(sourceId: string): Promise<void> {
    const [source] = await this.database.db
      .select({ id: marketingMonitoringSources.id })
      .from(marketingMonitoringSources)
      .where(
        and(
          eq(marketingMonitoringSources.id, sourceId),
          isNull(marketingMonitoringSources.deletedAt),
        ),
      )
      .limit(1);
    if (!source) {
      throw new BadRequestException(`Source ${sourceId} does not exist`);
    }
  }
}

function diffShape(
  before: MarketingMonitoringKeywordRow,
  after: MarketingMonitoringKeywordRow,
): Record<string, unknown> {
  const diff: Record<string, unknown> = {};
  for (const key of Object.keys(after) as (keyof MarketingMonitoringKeywordRow)[]) {
    if (key === 'updatedAt' || key === 'updatedBy') continue;
    if (before[key] !== after[key]) {
      diff[key] = { before: before[key], after: after[key] };
    }
  }
  return diff;
}
