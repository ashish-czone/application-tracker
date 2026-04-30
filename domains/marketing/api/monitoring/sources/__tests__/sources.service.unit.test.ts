import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { MonitoringSourcesService } from '../sources.service';
import {
  MARKETING_MONITORING_SOURCE_REGISTERED,
  MARKETING_MONITORING_SOURCE_UPDATED,
  MARKETING_MONITORING_SOURCE_REMOVED,
} from '../events/types';

/**
 * Build a thenable Drizzle-shaped chain mock.
 *
 * Drizzle query builders are awaitable directly (they implement `.then`),
 * so awaiting a chain at any point resolves it. Specific terminal awaits
 * (e.g. `.limit(1)` returning a row, `.returning()` returning inserted rows)
 * can be overridden per-test via `mockResolvedValueOnce`.
 */
function createThenableChain() {
  const chain: any = {};
  for (const method of ['from', 'where', 'limit', 'offset', 'orderBy', 'values', 'set']) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  chain.returning = vi.fn().mockResolvedValue([]);
  // Makes `await chain` resolve to undefined when no terminal mock fires.
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

const fakeRow = {
  id: 'src-123',
  kind: 'reddit',
  label: 'r/webdev',
  configJson: { subreddit: 'webdev', sort: 'new' },
  pollingCadenceMinutes: 15,
  isActive: true,
  lastFetchedAt: null,
  lastError: null,
  createdAt: new Date('2026-04-30T00:00:00Z'),
  createdBy: 'user-1',
  updatedAt: new Date('2026-04-30T00:00:00Z'),
  updatedBy: 'user-1',
  deletedAt: null,
  deletedBy: null,
};

describe('MonitoringSourcesService', () => {
  let service: MonitoringSourcesService;
  let mockDb: ReturnType<typeof createMockDb>;
  let events: { emit: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockDb = createMockDb();
    events = { emit: vi.fn() };
    service = new MonitoringSourcesService({ db: mockDb } as any, events as any);
  });

  describe('create', () => {
    it('inserts a row and emits MARKETING_MONITORING_SOURCE_REGISTERED', async () => {
      mockDb._chain.returning.mockResolvedValueOnce([fakeRow]);

      const result = await service.create(
        {
          kind: 'reddit',
          label: 'r/webdev',
          config: { subreddit: 'webdev', sort: 'new' },
          pollingCadenceMinutes: 15,
          isActive: true,
        } as any,
        'user-1',
      );

      expect(result).toEqual(fakeRow);
      expect(events.emit).toHaveBeenCalledOnce();
      expect(events.emit).toHaveBeenCalledWith(
        MARKETING_MONITORING_SOURCE_REGISTERED,
        expect.objectContaining({
          entityType: 'marketing.monitoring-sources',
          entityId: 'src-123',
          actorId: 'user-1',
          payload: expect.objectContaining({
            sourceId: 'src-123',
            kind: 'reddit',
            label: 'r/webdev',
            pollingCadenceMinutes: 15,
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns the row when found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([fakeRow]);
      const result = await service.findOne('src-123');
      expect(result).toEqual(fakeRow);
    });

    it('throws NotFoundException when no row matches', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);
      await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('emits MARKETING_MONITORING_SOURCE_UPDATED with diff payload', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([fakeRow]);
      const updatedRow = { ...fakeRow, label: 'r/webdev-renamed', updatedAt: new Date() };
      mockDb._chain.returning.mockResolvedValueOnce([updatedRow]);

      await service.update('src-123', { label: 'r/webdev-renamed' }, 'user-2');

      expect(events.emit).toHaveBeenCalledWith(
        MARKETING_MONITORING_SOURCE_UPDATED,
        expect.objectContaining({
          entityType: 'marketing.monitoring-sources',
          entityId: 'src-123',
          actorId: 'user-2',
          payload: expect.objectContaining({
            sourceId: 'src-123',
            changes: expect.objectContaining({
              label: { before: 'r/webdev', after: 'r/webdev-renamed' },
            }),
          }),
        }),
      );
    });
  });

  describe('softDelete', () => {
    it('emits MARKETING_MONITORING_SOURCE_REMOVED with the source label/kind', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([fakeRow]);

      await service.softDelete('src-123', 'user-2');

      expect(events.emit).toHaveBeenCalledWith(
        MARKETING_MONITORING_SOURCE_REMOVED,
        expect.objectContaining({
          entityType: 'marketing.monitoring-sources',
          entityId: 'src-123',
          actorId: 'user-2',
          payload: expect.objectContaining({
            sourceId: 'src-123',
            kind: 'reddit',
            label: 'r/webdev',
          }),
        }),
      );
    });
  });

  describe('recordPollSuccess / recordPollError', () => {
    it('does NOT emit a domain event for poll outcomes (operational only)', async () => {
      await service.recordPollSuccess('src-123');
      expect(events.emit).not.toHaveBeenCalled();

      await service.recordPollError('src-123', 'rate limited');
      expect(events.emit).not.toHaveBeenCalled();
    });
  });
});
