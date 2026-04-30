import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { MonitoringKeywordsService } from '../keywords.service';
import {
  MARKETING_MONITORING_KEYWORD_REGISTERED,
  MARKETING_MONITORING_KEYWORD_UPDATED,
  MARKETING_MONITORING_KEYWORD_REMOVED,
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

const fakeSource = { id: 'src-1' };
const fakeKeyword = {
  id: 'kw-1',
  sourceId: 'src-1',
  phrase: 'need developer',
  isRegex: false,
  isActive: true,
  createdAt: new Date('2026-04-30T00:00:00Z'),
  createdBy: 'user-1',
  updatedAt: new Date('2026-04-30T00:00:00Z'),
  updatedBy: 'user-1',
  deletedAt: null,
  deletedBy: null,
};

describe('MonitoringKeywordsService', () => {
  let service: MonitoringKeywordsService;
  let mockDb: ReturnType<typeof createMockDb>;
  let events: { emit: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockDb = createMockDb();
    events = { emit: vi.fn() };
    service = new MonitoringKeywordsService({ db: mockDb } as any, events as any);
  });

  describe('create', () => {
    it('rejects when source does not exist', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);
      await expect(
        service.create(
          { sourceId: 'src-x', phrase: 'foo', isRegex: false, isActive: true } as any,
          'user-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(events.emit).not.toHaveBeenCalled();
    });

    it('inserts and emits MARKETING_MONITORING_KEYWORD_REGISTERED', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([fakeSource]);
      mockDb._chain.returning.mockResolvedValueOnce([fakeKeyword]);

      const result = await service.create(
        { sourceId: 'src-1', phrase: 'need developer', isRegex: false, isActive: true } as any,
        'user-1',
      );

      expect(result).toEqual(fakeKeyword);
      expect(events.emit).toHaveBeenCalledWith(
        MARKETING_MONITORING_KEYWORD_REGISTERED,
        expect.objectContaining({
          entityType: 'marketing.monitoring-keywords',
          entityId: 'kw-1',
          actorId: 'user-1',
          payload: expect.objectContaining({
            keywordId: 'kw-1',
            sourceId: 'src-1',
            phrase: 'need developer',
            isRegex: false,
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns the keyword when found', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([fakeKeyword]);
      const result = await service.findOne('kw-1');
      expect(result).toEqual(fakeKeyword);
    });

    it('throws NotFoundException when missing', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);
      await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('emits MARKETING_MONITORING_KEYWORD_UPDATED with diff payload', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([fakeKeyword]);
      const updated = { ...fakeKeyword, phrase: 'hire me', updatedAt: new Date() };
      mockDb._chain.returning.mockResolvedValueOnce([updated]);

      await service.update('kw-1', { phrase: 'hire me' }, 'user-2');

      expect(events.emit).toHaveBeenCalledWith(
        MARKETING_MONITORING_KEYWORD_UPDATED,
        expect.objectContaining({
          entityType: 'marketing.monitoring-keywords',
          entityId: 'kw-1',
          actorId: 'user-2',
          payload: expect.objectContaining({
            keywordId: 'kw-1',
            sourceId: 'src-1',
            changes: expect.objectContaining({
              phrase: { before: 'need developer', after: 'hire me' },
            }),
          }),
        }),
      );
    });
  });

  describe('softDelete', () => {
    it('emits MARKETING_MONITORING_KEYWORD_REMOVED with sourceId and phrase', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([fakeKeyword]);

      await service.softDelete('kw-1', 'user-2');

      expect(events.emit).toHaveBeenCalledWith(
        MARKETING_MONITORING_KEYWORD_REMOVED,
        expect.objectContaining({
          entityType: 'marketing.monitoring-keywords',
          entityId: 'kw-1',
          actorId: 'user-2',
          payload: expect.objectContaining({
            keywordId: 'kw-1',
            sourceId: 'src-1',
            phrase: 'need developer',
          }),
        }),
      );
    });
  });

  describe('matches', () => {
    it('matches by case-insensitive substring when not regex', () => {
      expect(service.matches({ phrase: 'developer', isRegex: false }, 'Need a Developer')).toBe(true);
      expect(service.matches({ phrase: 'DEVELOPER', isRegex: false }, 'need a developer')).toBe(true);
      expect(service.matches({ phrase: 'lawyer', isRegex: false }, 'need developer')).toBe(false);
    });

    it('matches by case-insensitive regex when isRegex=true', () => {
      expect(
        service.matches({ phrase: 'react|vue|angular', isRegex: true }, 'Need a React engineer'),
      ).toBe(true);
      expect(service.matches({ phrase: '^Hire', isRegex: true }, 'hire me please')).toBe(true);
      expect(service.matches({ phrase: '^Hire', isRegex: true }, 'I want to hire someone')).toBe(false);
    });

    it('returns false for empty text', () => {
      expect(service.matches({ phrase: 'any', isRegex: false }, '')).toBe(false);
    });

    it('returns false rather than throwing on invalid regex', () => {
      expect(service.matches({ phrase: '[unclosed', isRegex: true }, 'anything')).toBe(false);
    });
  });
});
