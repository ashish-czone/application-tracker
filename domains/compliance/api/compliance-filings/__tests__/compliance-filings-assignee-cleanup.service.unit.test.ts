import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComplianceFilingsAssigneeCleanupService } from '../compliance-filings.assignee-cleanup.service';
import { COMPLIANCE_FILINGS_ASSIGNEE_CLEARED } from '../../events/types';

interface MockUpdateChain {
  update: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
}

function buildMocks(returning: Array<{ id: string }>) {
  const chain = {} as MockUpdateChain;
  chain.update = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue(returning);

  const database = { db: chain } as never;
  const events = { emitDynamic: vi.fn() };
  const appLogger = {
    forContext: () => ({ log: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  };
  const service = new ComplianceFilingsAssigneeCleanupService(
    database as never,
    events as never,
    appLogger as never,
  );
  return { service, chain, events };
}

describe('ComplianceFilingsAssigneeCleanupService', () => {
  describe('clearAssigneeForUser', () => {
    it('runs a bulk update that clears assigneeId and returns the affected ids', async () => {
      const affected = [{ id: 'filing-1' }, { id: 'filing-2' }, { id: 'filing-3' }];
      const { service, chain } = buildMocks(affected);

      const result = await service.clearAssigneeForUser('user-x', 'admin-1');

      expect(result.filingIds).toEqual(['filing-1', 'filing-2', 'filing-3']);
      // One UPDATE statement, not N — the bulk-update is the whole point.
      expect(chain.update).toHaveBeenCalledTimes(1);
      expect(chain.set).toHaveBeenCalledWith({ assigneeId: null });
    });

    it('emits one batched compliance.FilingsAssigneeCleared event with every filing id', async () => {
      const affected = [{ id: 'f1' }, { id: 'f2' }, { id: 'f3' }];
      const { service, events } = buildMocks(affected);

      await service.clearAssigneeForUser('user-x', 'admin-1');

      expect(events.emitDynamic).toHaveBeenCalledTimes(1);
      const [eventName, envelope] = events.emitDynamic.mock.calls[0];
      expect(eventName).toBe(COMPLIANCE_FILINGS_ASSIGNEE_CLEARED);
      expect(envelope).toMatchObject({
        entityType: 'compliance',
        entityId: 'user-x',
        actorId: 'admin-1',
        payload: {
          deactivatedUserId: 'user-x',
          filingIds: ['f1', 'f2', 'f3'],
          count: 3,
        },
      });
    });

    it('emits no event and returns an empty list when nothing was assigned to the user', async () => {
      const { service, events } = buildMocks([]);

      const result = await service.clearAssigneeForUser('user-y', 'admin-1');

      expect(result.filingIds).toEqual([]);
      expect(events.emitDynamic).not.toHaveBeenCalled();
    });

    it('forwards actorId from the cascade caller, not a hardcoded null', async () => {
      const { service, events } = buildMocks([{ id: 'f1' }]);

      await service.clearAssigneeForUser('user-x', 'specific-actor-id');

      const envelope = events.emitDynamic.mock.calls[0][1];
      expect(envelope.actorId).toBe('specific-actor-id');
    });
  });
});
