import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import {
  DatabaseService,
  eq,
  and,
  or,
  isNull,
  ilike,
  asc,
  desc,
  count,
  inArray,
  gte,
  lte,
  sql,
} from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import {
  marketingMonitoringItems,
  type MarketingMonitoringItemRow,
  type MonitoringItemStatus,
} from './schema/items';
import type { ListMonitoringItemsQuery } from './dto/list-items-query.dto';
import type {
  MarkEngagedInput,
  DismissItemInput,
  SnoozeItemInput,
} from './dto/inbox-actions.dto';
import { MonitoringKeywordsService } from '../keywords/keywords.service';
import {
  MARKETING_MONITORING_ITEM_INGESTED,
  MARKETING_MONITORING_ITEM_ENGAGED,
  MARKETING_MONITORING_ITEM_DISMISSED,
  MARKETING_MONITORING_ITEM_SNOOZED,
  MARKETING_MONITORING_ITEM_CONVERTED_TO_LEAD,
  type MarketingMonitoringItemIngestedPayload,
  type MarketingMonitoringItemEngagedPayload,
  type MarketingMonitoringItemDismissedPayload,
  type MarketingMonitoringItemSnoozedPayload,
  type MarketingMonitoringItemConvertedToLeadPayload,
} from './events/types';

export interface PaginatedResult<T> {
  data: T[];
  meta: { page: number; limit: number; total: number };
}

/**
 * Normalised raw item shape that pollers (M1.4) hand to ingestItem.
 * Each poller maps source-platform-specific fields into this shape.
 */
export interface RawMonitoringItem {
  externalId: string;
  url: string;
  author?: string | null;
  title?: string | null;
  bodyExcerpt?: string | null;
  postedAt?: Date | null;
}

@Injectable()
export class MonitoringItemsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly events: DomainEventEmitter,
    private readonly keywords: MonitoringKeywordsService,
  ) {}

  // ─────────────────────────────────────────────────────────────────
  // Inbox queries
  // ─────────────────────────────────────────────────────────────────

  async list(
    query: ListMonitoringItemsQuery,
  ): Promise<PaginatedResult<MarketingMonitoringItemRow>> {
    const { page, limit, sourceId, status, matchedKeywordId, q, postedAfter, postedBefore, sort } =
      query;
    const offset = (page - 1) * limit;
    const now = new Date();

    const conditions = [isNull(marketingMonitoringItems.deletedAt)];
    if (sourceId) conditions.push(eq(marketingMonitoringItems.sourceId, sourceId));
    if (q) {
      conditions.push(
        or(
          ilike(marketingMonitoringItems.title, `%${q}%`),
          ilike(marketingMonitoringItems.bodyExcerpt, `%${q}%`),
        )!,
      );
    }
    if (matchedKeywordId) {
      conditions.push(
        sql`${matchedKeywordId} = ANY(${marketingMonitoringItems.matchedKeywordIds})`,
      );
    }
    if (postedAfter) conditions.push(gte(marketingMonitoringItems.postedAt, postedAfter));
    if (postedBefore) conditions.push(lte(marketingMonitoringItems.postedAt, postedBefore));

    if (status) {
      if (status === 'new') {
        // "Actionable now" = literally new OR snoozed-and-expired
        conditions.push(
          or(
            eq(marketingMonitoringItems.status, 'new'),
            and(
              eq(marketingMonitoringItems.status, 'snoozed'),
              lte(marketingMonitoringItems.snoozedUntil, now),
            ),
          )!,
        );
      } else if (status === 'snoozed') {
        // "Currently snoozed" = status='snoozed' AND snooze still in the future
        conditions.push(
          and(
            eq(marketingMonitoringItems.status, 'snoozed'),
            gte(marketingMonitoringItems.snoozedUntil, now),
          )!,
        );
      } else {
        conditions.push(eq(marketingMonitoringItems.status, status));
      }
    }

    const where = and(...conditions);

    const orderBy = (() => {
      const desc_ = sort.startsWith('-');
      const field = desc_ ? sort.slice(1) : sort;
      const direction = desc_ ? desc : asc;
      switch (field) {
        case 'postedAt':
          return direction(marketingMonitoringItems.postedAt);
        case 'fetchedAt':
        default:
          return direction(marketingMonitoringItems.fetchedAt);
      }
    })();

    const [rows, [{ value: total }]] = await Promise.all([
      this.database.db
        .select()
        .from(marketingMonitoringItems)
        .where(where)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
      this.database.db
        .select({ value: count() })
        .from(marketingMonitoringItems)
        .where(where),
    ]);

    return { data: rows, meta: { page, limit, total: Number(total) } };
  }

  async findOne(id: string): Promise<MarketingMonitoringItemRow> {
    const [row] = await this.database.db
      .select()
      .from(marketingMonitoringItems)
      .where(
        and(
          eq(marketingMonitoringItems.id, id),
          isNull(marketingMonitoringItems.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException(`Monitoring item ${id} not found`);
    return row;
  }

  // ─────────────────────────────────────────────────────────────────
  // Ingestion (called by pollers in M1.4)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Ingest a fetched item. Returns the stored row, or null if dropped.
   *
   * Drop cases:
   *   - No active keywords for the source → drop (operator hasn't told
   *     us what to look for; ingesting everything would flood the inbox)
   *   - No active keyword matches against title or bodyExcerpt → drop
   *
   * Dedup: (sourceId, externalId) collisions are silent no-ops; the
   * existing row is returned without re-emitting INGESTED.
   */
  async ingestItem(
    sourceId: string,
    raw: RawMonitoringItem,
  ): Promise<MarketingMonitoringItemRow | null> {
    const [existing] = await this.database.db
      .select()
      .from(marketingMonitoringItems)
      .where(
        and(
          eq(marketingMonitoringItems.sourceId, sourceId),
          eq(marketingMonitoringItems.externalId, raw.externalId),
        ),
      )
      .limit(1);
    if (existing) return existing;

    const activeKeywords = await this.keywords.listActiveForSource(sourceId);
    if (activeKeywords.length === 0) return null;

    const haystack = `${raw.title ?? ''} ${raw.bodyExcerpt ?? ''}`.trim();
    const matchedKeywordIds = activeKeywords
      .filter((kw) => this.keywords.matches(kw, haystack))
      .map((kw) => kw.id);

    if (matchedKeywordIds.length === 0) return null;

    const [row] = await this.database.db
      .insert(marketingMonitoringItems)
      .values({
        sourceId,
        externalId: raw.externalId,
        url: raw.url,
        author: raw.author ?? null,
        title: raw.title ?? null,
        bodyExcerpt: raw.bodyExcerpt ?? null,
        postedAt: raw.postedAt ?? null,
        matchedKeywordIds,
        status: 'new',
      })
      .returning();

    this.events.emit(MARKETING_MONITORING_ITEM_INGESTED, {
      entityType: 'marketing.monitoring-items',
      entityId: row.id,
      actorId: null,
      payload: {
        itemId: row.id,
        sourceId: row.sourceId,
        externalId: row.externalId,
        url: row.url,
        matchedKeywordIds: row.matchedKeywordIds,
      } satisfies MarketingMonitoringItemIngestedPayload,
    });

    return row;
  }

  // ─────────────────────────────────────────────────────────────────
  // Inbox actions
  // ─────────────────────────────────────────────────────────────────

  async markEngaged(
    id: string,
    input: MarkEngagedInput,
    actorId: string,
  ): Promise<MarketingMonitoringItemRow> {
    const item = await this.findOne(id);
    this.assertTransitionAllowed(item.status as MonitoringItemStatus, 'engaged');

    const [row] = await this.database.db
      .update(marketingMonitoringItems)
      .set({
        status: 'engaged',
        engagementNote: input.note ?? null,
        snoozedUntil: null,
        updatedBy: actorId,
      })
      .where(eq(marketingMonitoringItems.id, id))
      .returning();

    this.events.emit(MARKETING_MONITORING_ITEM_ENGAGED, {
      entityType: 'marketing.monitoring-items',
      entityId: id,
      actorId,
      payload: {
        itemId: id,
        sourceId: row.sourceId,
        url: row.url,
        note: input.note,
      } satisfies MarketingMonitoringItemEngagedPayload,
    });
    return row;
  }

  async dismiss(
    id: string,
    input: DismissItemInput,
    actorId: string,
  ): Promise<MarketingMonitoringItemRow> {
    const item = await this.findOne(id);
    this.assertTransitionAllowed(item.status as MonitoringItemStatus, 'dismissed');

    const [row] = await this.database.db
      .update(marketingMonitoringItems)
      .set({
        status: 'dismissed',
        engagementNote: input.note ?? null,
        snoozedUntil: null,
        updatedBy: actorId,
      })
      .where(eq(marketingMonitoringItems.id, id))
      .returning();

    this.events.emit(MARKETING_MONITORING_ITEM_DISMISSED, {
      entityType: 'marketing.monitoring-items',
      entityId: id,
      actorId,
      payload: {
        itemId: id,
        sourceId: row.sourceId,
        url: row.url,
        note: input.note,
      } satisfies MarketingMonitoringItemDismissedPayload,
    });
    return row;
  }

  async snooze(
    id: string,
    input: SnoozeItemInput,
    actorId: string,
  ): Promise<MarketingMonitoringItemRow> {
    const item = await this.findOne(id);
    this.assertTransitionAllowed(item.status as MonitoringItemStatus, 'snoozed');

    const [row] = await this.database.db
      .update(marketingMonitoringItems)
      .set({
        status: 'snoozed',
        snoozedUntil: input.snoozedUntil,
        engagementNote: input.note ?? null,
        updatedBy: actorId,
      })
      .where(eq(marketingMonitoringItems.id, id))
      .returning();

    this.events.emit(MARKETING_MONITORING_ITEM_SNOOZED, {
      entityType: 'marketing.monitoring-items',
      entityId: id,
      actorId,
      payload: {
        itemId: id,
        sourceId: row.sourceId,
        url: row.url,
        snoozedUntil: input.snoozedUntil.toISOString(),
        note: input.note,
      } satisfies MarketingMonitoringItemSnoozedPayload,
    });
    return row;
  }

  /**
   * Stamp the item as converted to a lead. Called from the cross-domain
   * handler when the operator clicks "convert to lead" in the inbox UI;
   * the lead itself lives in marketing/leads (M2) with a back-FK to this
   * item. We do NOT enforce that the lead exists from here — direction
   * of FK is leads→items, not items→leads.
   */
  async markConvertedToLead(
    id: string,
    actorId: string,
  ): Promise<MarketingMonitoringItemRow> {
    const item = await this.findOne(id);
    if (item.status === 'converted_lead') {
      throw new ConflictException(`Item ${id} is already converted to a lead`);
    }

    const [row] = await this.database.db
      .update(marketingMonitoringItems)
      .set({
        status: 'converted_lead',
        snoozedUntil: null,
        updatedBy: actorId,
      })
      .where(eq(marketingMonitoringItems.id, id))
      .returning();

    this.events.emit(MARKETING_MONITORING_ITEM_CONVERTED_TO_LEAD, {
      entityType: 'marketing.monitoring-items',
      entityId: id,
      actorId,
      payload: {
        itemId: id,
        sourceId: row.sourceId,
        url: row.url,
      } satisfies MarketingMonitoringItemConvertedToLeadPayload,
    });
    return row;
  }

  // ─────────────────────────────────────────────────────────────────
  // Internal
  // ─────────────────────────────────────────────────────────────────

  /**
   * Items in 'converted_lead' or 'dismissed' are terminal — no further
   * inbox actions. Keeps state machine honest. 'engaged' can transition
   * back to 'dismissed' or forward to 'converted_lead'.
   */
  private assertTransitionAllowed(
    from: MonitoringItemStatus,
    to: MonitoringItemStatus,
  ): void {
    if (from === 'converted_lead') {
      throw new ConflictException(
        `Item is in terminal status 'converted_lead'; cannot transition to '${to}'`,
      );
    }
    if (from === 'dismissed' && to !== 'engaged') {
      throw new ConflictException(
        `Dismissed items can only be re-engaged; cannot transition to '${to}'`,
      );
    }
  }
}
