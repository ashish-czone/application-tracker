import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { MonitoringItemsService } from '../items.service';
import {
  MARKETING_MONITORING_ITEM_INGESTED,
  MARKETING_MONITORING_ITEM_ENGAGED,
  MARKETING_MONITORING_ITEM_DISMISSED,
  MARKETING_MONITORING_ITEM_SNOOZED,
  MARKETING_MONITORING_ITEM_CONVERTED_TO_LEAD,
} from '../events/types';

function createThenableChain() {
  const chain: any = {};
  for (const m of ['from', 'where', 'limit', 'offset', 'orderBy', 'values', 'set']) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.returning = vi.fn().mockResolvedValue([]);
  chain.then = (resolve: (v: unknown) => unknown) => resolve(undefined);
  return chain;
}

function createMockDb() {
  const chain = createThenableChain();
  return {
    select: vi.fn().mockReturnValue(chain),
    insert: vi.fn().mockReturnValue(chain),
    update: vi.fn().mockReturnValue(chain),
    _chain: chain,
  };
}

const fakeItem = {
  id: 'item-1',
  sourceId: 'src-1',
  externalId: 'reddit_t3_abc',
  url: 'https://reddit.com/r/webdev/comments/abc',
  author: 'user42',
  title: 'Need a developer for SaaS MVP',
  bodyExcerpt: 'Looking for a React/Node engineer for a 6-week project',
  matchedKeywordIds: ['kw-1'],
  postedAt: new Date('2026-04-30T08:00:00Z'),
  fetchedAt: new Date('2026-04-30T08:15:00Z'),
  status: 'new' as const,
  snoozedUntil: null,
  engagementNote: null,
  createdAt: new Date('2026-04-30T08:15:00Z'),
  updatedAt: new Date('2026-04-30T08:15:00Z'),
  updatedBy: null,
  deletedAt: null,
  deletedBy: null,
};

describe('MonitoringItemsService', () => {
  let service: MonitoringItemsService;
  let mockDb: ReturnType<typeof createMockDb>;
  let events: { emit: ReturnType<typeof vi.fn> };
  let keywords: {
    listActiveForSource: ReturnType<typeof vi.fn>;
    matches: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockDb = createMockDb();
    events = { emit: vi.fn() };
    keywords = {
      listActiveForSource: vi.fn(),
      matches: vi.fn(),
    };
    service = new MonitoringItemsService(
      { db: mockDb } as any,
      events as any,
      keywords as any,
    );
  });

  // ──────────────────────────────────────────────────────────
  // ingestItem
  // ──────────────────────────────────────────────────────────

  describe('ingestItem', () => {
    it('returns existing row and does NOT emit when (sourceId, externalId) is already stored', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([fakeItem]);

      const result = await service.ingestItem('src-1', {
        externalId: 'reddit_t3_abc',
        url: 'https://reddit.com/r/webdev/comments/abc',
      });

      expect(result).toEqual(fakeItem);
      expect(events.emit).not.toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('drops the item when source has no active keywords', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);
      keywords.listActiveForSource.mockResolvedValueOnce([]);

      const result = await service.ingestItem('src-1', {
        externalId: 'new-thing',
        url: 'https://example.com/x',
        title: 'anything',
      });

      expect(result).toBeNull();
      expect(events.emit).not.toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('drops the item when no active keyword matches', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);
      keywords.listActiveForSource.mockResolvedValueOnce([
        { id: 'kw-1', phrase: 'react', isRegex: false },
        { id: 'kw-2', phrase: 'lawyer', isRegex: false },
      ]);
      keywords.matches.mockReturnValue(false);

      const result = await service.ingestItem('src-1', {
        externalId: 'new-thing',
        url: 'https://example.com/x',
        title: 'unrelated topic',
      });

      expect(result).toBeNull();
      expect(events.emit).not.toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('inserts and emits MARKETING_MONITORING_ITEM_INGESTED when at least one keyword matches', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);
      keywords.listActiveForSource.mockResolvedValueOnce([
        { id: 'kw-1', phrase: 'react', isRegex: false },
        { id: 'kw-2', phrase: 'lawyer', isRegex: false },
      ]);
      // 'react' matches, 'lawyer' doesn't
      keywords.matches.mockImplementation(
        (kw: { phrase: string }) => kw.phrase === 'react',
      );
      mockDb._chain.returning.mockResolvedValueOnce([fakeItem]);

      const result = await service.ingestItem('src-1', {
        externalId: 'reddit_t3_abc',
        url: 'https://reddit.com/r/webdev/comments/abc',
        title: 'Need a React developer',
        bodyExcerpt: 'six week project',
      });

      expect(result).toEqual(fakeItem);
      expect(events.emit).toHaveBeenCalledWith(
        MARKETING_MONITORING_ITEM_INGESTED,
        expect.objectContaining({
          entityType: 'marketing.monitoring-items',
          entityId: 'item-1',
          actorId: null,
          payload: expect.objectContaining({
            itemId: 'item-1',
            sourceId: 'src-1',
            externalId: 'reddit_t3_abc',
            matchedKeywordIds: ['kw-1'],
          }),
        }),
      );
    });
  });

  // ──────────────────────────────────────────────────────────
  // Inbox actions + state machine
  // ──────────────────────────────────────────────────────────

  describe('markEngaged', () => {
    it('transitions new → engaged and emits ENGAGED', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([fakeItem]);
      mockDb._chain.returning.mockResolvedValueOnce([
        { ...fakeItem, status: 'engaged', engagementNote: 'replied on the thread' },
      ]);

      await service.markEngaged('item-1', { note: 'replied on the thread' }, 'user-2');

      expect(events.emit).toHaveBeenCalledWith(
        MARKETING_MONITORING_ITEM_ENGAGED,
        expect.objectContaining({
          payload: expect.objectContaining({
            itemId: 'item-1',
            note: 'replied on the thread',
          }),
        }),
      );
    });

    it('refuses to mark a converted_lead item as engaged', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([{ ...fakeItem, status: 'converted_lead' }]);
      await expect(service.markEngaged('item-1', {}, 'user-2')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(events.emit).not.toHaveBeenCalled();
    });
  });

  describe('dismiss', () => {
    it('transitions new → dismissed and emits DISMISSED', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([fakeItem]);
      mockDb._chain.returning.mockResolvedValueOnce([{ ...fakeItem, status: 'dismissed' }]);

      await service.dismiss('item-1', { note: 'irrelevant' }, 'user-2');

      expect(events.emit).toHaveBeenCalledWith(
        MARKETING_MONITORING_ITEM_DISMISSED,
        expect.objectContaining({
          payload: expect.objectContaining({ itemId: 'item-1', note: 'irrelevant' }),
        }),
      );
    });
  });

  describe('snooze', () => {
    it('transitions to snoozed with snoozedUntil and emits SNOOZED', async () => {
      const future = new Date(Date.now() + 60 * 60 * 1000);
      mockDb._chain.limit.mockResolvedValueOnce([fakeItem]);
      mockDb._chain.returning.mockResolvedValueOnce([
        { ...fakeItem, status: 'snoozed', snoozedUntil: future },
      ]);

      await service.snooze('item-1', { snoozedUntil: future }, 'user-2');

      expect(events.emit).toHaveBeenCalledWith(
        MARKETING_MONITORING_ITEM_SNOOZED,
        expect.objectContaining({
          payload: expect.objectContaining({
            itemId: 'item-1',
            snoozedUntil: future.toISOString(),
          }),
        }),
      );
    });
  });

  describe('markConvertedToLead', () => {
    it('transitions to converted_lead and emits CONVERTED_TO_LEAD', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([fakeItem]);
      mockDb._chain.returning.mockResolvedValueOnce([
        { ...fakeItem, status: 'converted_lead' },
      ]);

      await service.markConvertedToLead('item-1', 'user-2');

      expect(events.emit).toHaveBeenCalledWith(
        MARKETING_MONITORING_ITEM_CONVERTED_TO_LEAD,
        expect.objectContaining({
          payload: expect.objectContaining({ itemId: 'item-1' }),
        }),
      );
    });

    it('refuses to convert an already-converted item (idempotency guard)', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([{ ...fakeItem, status: 'converted_lead' }]);
      await expect(service.markConvertedToLead('item-1', 'user-2')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(events.emit).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException for missing items', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);
      await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
