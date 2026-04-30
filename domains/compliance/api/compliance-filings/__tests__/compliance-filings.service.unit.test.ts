import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComplianceFilingsService } from '../compliance-filings.service';

describe('ComplianceFilingsService', () => {
  let entityService: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };
  let lawsService: { findDisplayByIds: ReturnType<typeof vi.fn> };
  let service: ComplianceFilingsService;

  beforeEach(() => {
    entityService = {
      create: vi.fn().mockResolvedValue({ id: 'filing-1' }),
      update: vi.fn().mockResolvedValue({ id: 'filing-1' }),
      list: vi.fn(),
    };
    lawsService = {
      findDisplayByIds: vi.fn().mockResolvedValue([]),
    };
    service = new ComplianceFilingsService(entityService as never, lawsService as never);
  });

  describe('create — externalKey derivation', () => {
    it('derives externalKey from (ruleId, clientId, periodStart) when absent', async () => {
      await service.create(
        {
          title: 'Filing',
          ruleId: 'r1',
          clientId: 'c1',
          periodStart: '2026-04-01',
        } as never,
        'actor',
      );
      const payload = entityService.create.mock.calls[0][0] as Record<string, unknown>;
      expect(payload.externalKey).toBe('r1:c1:2026-04-01');
    });

    it('preserves externalKey when already set', async () => {
      await service.create(
        {
          title: 'Filing',
          ruleId: 'r1',
          clientId: 'c1',
          periodStart: '2026-04-01',
          externalKey: 'pre-set-key',
        } as never,
        'actor',
      );
      const payload = entityService.create.mock.calls[0][0] as Record<string, unknown>;
      expect(payload.externalKey).toBe('pre-set-key');
    });

    it('does not set externalKey when the tuple is incomplete', async () => {
      await service.create({ title: 'Filing', ruleId: 'r1' } as never, 'actor');
      const payload = entityService.create.mock.calls[0][0] as Record<string, unknown>;
      expect(payload.externalKey).toBeUndefined();
    });
  });

  describe('create — completedAt stamping', () => {
    it('stamps completedAt when created in completed state', async () => {
      await service.create({ title: 'Filing', status: 'completed' } as never, 'actor');
      const payload = entityService.create.mock.calls[0][0] as Record<string, unknown>;
      expect(payload.completedAt).toBeInstanceOf(Date);
    });

    it('clears completedAt for non-completed status on create', async () => {
      await service.create({ title: 'Filing', status: 'pending' } as never, 'actor');
      const payload = entityService.create.mock.calls[0][0] as Record<string, unknown>;
      expect(payload.completedAt).toBeNull();
    });
  });

  describe('update — completedAt stamping', () => {
    it('stamps completedAt when transitioning to completed', async () => {
      await service.update('id', { status: 'completed' } as never, 'actor');
      const payload = entityService.update.mock.calls[0][1] as Record<string, unknown>;
      expect(payload.completedAt).toBeInstanceOf(Date);
    });

    it('clears completedAt when transitioning away from completed', async () => {
      await service.update('id', { status: 'in_progress' } as never, 'actor');
      const payload = entityService.update.mock.calls[0][1] as Record<string, unknown>;
      expect(payload.completedAt).toBeNull();
    });

    it('does not touch completedAt when status is not in the payload', async () => {
      await service.update('id', { title: 'new title' } as never, 'actor');
      const payload = entityService.update.mock.calls[0][1] as Record<string, unknown>;
      expect('completedAt' in payload).toBe(false);
    });
  });

  describe('list — law display injection', () => {
    it('injects lawCode, lawName, lawJurisdiction onto each row from a single batched LawsService call', async () => {
      entityService.list.mockResolvedValue({
        data: [
          { id: 'f1', lawId: 'law-a', clientId: 'c1' },
          { id: 'f2', lawId: 'law-b', clientId: 'c2' },
          { id: 'f3', lawId: 'law-a', clientId: 'c3' },
        ],
        meta: { total: 3, page: 1, limit: 20, totalPages: 1 },
      });
      lawsService.findDisplayByIds.mockResolvedValue([
        { id: 'law-a', code: 'XYZ-12', name: 'Law A', jurisdiction: 'central' },
        { id: 'law-b', code: 'ABC-99', name: 'Law B', jurisdiction: 'state' },
      ]);

      const result = await service.list({});

      expect(lawsService.findDisplayByIds).toHaveBeenCalledTimes(1);
      const idsArg = lawsService.findDisplayByIds.mock.calls[0][0] as string[];
      expect(new Set(idsArg)).toEqual(new Set(['law-a', 'law-b']));

      expect(result.data).toEqual([
        { id: 'f1', lawId: 'law-a', clientId: 'c1', lawCode: 'XYZ-12', lawName: 'Law A', lawJurisdiction: 'central' },
        { id: 'f2', lawId: 'law-b', clientId: 'c2', lawCode: 'ABC-99', lawName: 'Law B', lawJurisdiction: 'state' },
        { id: 'f3', lawId: 'law-a', clientId: 'c3', lawCode: 'XYZ-12', lawName: 'Law A', lawJurisdiction: 'central' },
      ]);
    });

    it('returns rows unchanged when no rows have a lawId', async () => {
      entityService.list.mockResolvedValue({
        data: [{ id: 'f1', clientId: 'c1' }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });

      const result = await service.list({});

      expect(lawsService.findDisplayByIds).not.toHaveBeenCalled();
      expect(result.data).toEqual([{ id: 'f1', clientId: 'c1' }]);
    });

    it('leaves a row untouched when its lawId is missing from the law batch', async () => {
      entityService.list.mockResolvedValue({
        data: [
          { id: 'f1', lawId: 'law-a' },
          { id: 'f2', lawId: 'law-deleted' },
        ],
        meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
      });
      lawsService.findDisplayByIds.mockResolvedValue([
        { id: 'law-a', code: 'XYZ-12', name: 'Law A', jurisdiction: 'central' },
      ]);

      const result = await service.list({});

      expect(result.data).toEqual([
        { id: 'f1', lawId: 'law-a', lawCode: 'XYZ-12', lawName: 'Law A', lawJurisdiction: 'central' },
        { id: 'f2', lawId: 'law-deleted' },
      ]);
    });

    it('preserves meta from the underlying entity-engine list call', async () => {
      const meta = { total: 47, page: 2, limit: 20, totalPages: 3 };
      entityService.list.mockResolvedValue({ data: [], meta });

      const result = await service.list({ page: 2, limit: 20 });

      expect(result.meta).toEqual(meta);
    });
  });
});
