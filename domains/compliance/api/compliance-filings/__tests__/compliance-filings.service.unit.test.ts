import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComplianceFilingsService } from '../compliance-filings.service';

describe('ComplianceFilingsService', () => {
  let entityService: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let service: ComplianceFilingsService;

  beforeEach(() => {
    entityService = {
      create: vi.fn().mockResolvedValue({ id: 'filing-1' }),
      update: vi.fn().mockResolvedValue({ id: 'filing-1' }),
    };
    service = new ComplianceFilingsService(entityService as never);
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
});
