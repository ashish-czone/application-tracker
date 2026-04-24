import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ClientRegistrationsService } from '../client-registrations.service';
import type { DomainEventEmitter } from '@packages/events';
import type { AppLoggerService } from '@packages/logger';
import type { ComplianceFilingsCancellationService } from '../../compliance-filings/compliance-filings-cancellation.service';

type AnyChain = Record<string, ReturnType<typeof vi.fn>>;

function mockSelectRows(rows: unknown[]) {
  const chain: AnyChain = {} as AnyChain;
  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.leftJoin = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(rows);
  return chain;
}

function mockInsertReturning(row: unknown) {
  const chain: AnyChain = {} as AnyChain;
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue([row]);
  return chain;
}

function mockUpdate() {
  const chain: AnyChain = {} as AnyChain;
  chain.set = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(undefined);
  return chain;
}

describe('ClientRegistrationsService', () => {
  let db: { db: Record<string, ReturnType<typeof vi.fn>> };
  let events: { emitDynamic: ReturnType<typeof vi.fn> };
  let filingsCancellation: { cancelFilings: ReturnType<typeof vi.fn> };
  let service: ClientRegistrationsService;

  const activeRow = {
    id: 'reg1',
    clientId: 'c1',
    lawId: 'l1',
    registeredAt: new Date('2026-01-01'),
    deactivatedAt: null,
  };

  const appLogger = {
    forContext: vi.fn().mockReturnValue({
      log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    }),
  } as unknown as AppLoggerService;

  beforeEach(() => {
    db = {
      db: {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        transaction: vi.fn(),
      },
    };
    events = { emitDynamic: vi.fn() };
    filingsCancellation = { cancelFilings: vi.fn().mockResolvedValue(undefined) };
    service = new ClientRegistrationsService(
      {} as never,
      db as never,
      events as unknown as DomainEventEmitter,
      filingsCancellation as unknown as ComplianceFilingsCancellationService,
      appLogger,
    );
  });

  describe('register', () => {
    it('inserts when no active registration exists', async () => {
      db.db.select.mockReturnValueOnce(mockSelectRows([]));
      const insertChain = mockInsertReturning(activeRow);
      db.db.insert.mockReturnValue(insertChain);

      const result = await service.register('c1', 'l1');

      expect(insertChain.values).toHaveBeenCalledWith({ clientId: 'c1', lawId: 'l1' });
      expect(result.clientId).toBe('c1');
      expect(result.deactivatedAt).toBeNull();
    });

    it('throws ConflictException when active registration already exists', async () => {
      db.db.select.mockReturnValueOnce(mockSelectRows([activeRow]));
      await expect(service.register('c1', 'l1')).rejects.toBeInstanceOf(ConflictException);
      expect(db.db.insert).not.toHaveBeenCalled();
    });
  });

  describe('registerMany', () => {
    function mockTx(opts: {
      existing: Record<string, unknown[]>;
      insertRow: (lawId: string) => unknown;
    }) {
      const tx = {
        select: vi.fn(() => {
          const chain: AnyChain = {} as AnyChain;
          chain.from = vi.fn().mockReturnValue(chain);
          chain.where = vi.fn((..._args: unknown[]) => {
            // Return the queued row set for the next (clientId, lawId) lookup
            const lawId = txLawQueue.shift();
            return Promise.resolve(opts.existing[lawId ?? ''] ?? []);
          });
          return chain;
        }),
        insert: vi.fn(() => {
          const chain: AnyChain = {} as AnyChain;
          let captured: { clientId: string; lawId: string } | undefined;
          chain.values = vi.fn((v: { clientId: string; lawId: string }) => {
            captured = v;
            return chain;
          });
          chain.returning = vi.fn(() =>
            Promise.resolve([opts.insertRow(captured?.lawId ?? '')]),
          );
          return chain;
        }),
      };
      // Ordered queue of lawIds the select-chain .where calls will consume.
      // The service walks laws[] in resolution order; tests set this up.
      const txLawQueue: string[] = [];
      return { tx, enqueueLawIds: (ids: string[]) => txLawQueue.push(...ids) };
    }

    it('returns empty array and emits nothing when lawCodes is empty', async () => {
      const result = await service.registerMany('c1', [], 'user-1');
      expect(result).toEqual([]);
      expect(db.db.select).not.toHaveBeenCalled();
      expect(events.emitDynamic).not.toHaveBeenCalled();
    });

    it('rejects the whole batch when any code is unknown', async () => {
      db.db.select.mockReturnValueOnce(mockSelectRows([{ id: 'l1', code: 'GST' }]));

      await expect(
        service.registerMany('c1', ['GST', 'UNKNOWN'], 'user-1'),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(db.db.transaction).not.toHaveBeenCalled();
      expect(events.emitDynamic).not.toHaveBeenCalled();
    });

    it('inserts new registrations, skips active ones, and emits only for inserts', async () => {
      // Code resolution: two known laws
      db.db.select.mockReturnValueOnce(
        mockSelectRows([
          { id: 'l1', code: 'GST' },
          { id: 'l2', code: 'ITR' },
        ]),
      );

      const existingForL1 = { ...activeRow, id: 'reg-existing', lawId: 'l1' };
      const { tx, enqueueLawIds } = mockTx({
        existing: { l1: [existingForL1], l2: [] },
        insertRow: (lawId) => ({
          id: `reg-${lawId}`,
          clientId: 'c1',
          lawId,
          registeredAt: new Date('2026-04-10'),
          deactivatedAt: null,
        }),
      });
      enqueueLawIds(['l1', 'l2']);
      db.db.transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));

      const result = await service.registerMany('c1', ['GST', 'ITR'], 'user-1');

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.lawId).sort()).toEqual(['l1', 'l2']);
      // Only the newly inserted l2 should emit
      expect(events.emitDynamic).toHaveBeenCalledTimes(1);
      expect(events.emitDynamic).toHaveBeenCalledWith(
        'client-registrations.Created',
        expect.objectContaining({
          entityType: 'client-registrations',
          entityId: 'reg-l2',
          actorId: 'user-1',
        }),
      );
    });

    it('is idempotent when every code is already active', async () => {
      db.db.select.mockReturnValueOnce(mockSelectRows([{ id: 'l1', code: 'GST' }]));

      const { tx, enqueueLawIds } = mockTx({
        existing: { l1: [{ ...activeRow, lawId: 'l1' }] },
        insertRow: () => {
          throw new Error('insert should not be called when active row exists');
        },
      });
      enqueueLawIds(['l1']);
      db.db.transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));

      const result = await service.registerMany('c1', ['GST'], 'user-1');

      expect(result).toHaveLength(1);
      expect(events.emitDynamic).not.toHaveBeenCalled();
    });

    it('deduplicates repeated codes in the input', async () => {
      db.db.select.mockReturnValueOnce(mockSelectRows([{ id: 'l1', code: 'GST' }]));

      const { tx, enqueueLawIds } = mockTx({
        existing: { l1: [] },
        insertRow: (lawId) => ({
          id: `reg-${lawId}`,
          clientId: 'c1',
          lawId,
          registeredAt: new Date(),
          deactivatedAt: null,
        }),
      });
      enqueueLawIds(['l1']);
      db.db.transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));

      const result = await service.registerMany('c1', ['GST', 'GST'], 'user-1');

      expect(result).toHaveLength(1);
      expect(events.emitDynamic).toHaveBeenCalledTimes(1);
    });
  });

  describe('previewDeactivation', () => {
    const pastDate = new Date('2026-03-01T00:00:00Z');

    function wireFindActive(rows: unknown[]) {
      db.db.select.mockReturnValueOnce(mockSelectRows(rows));
    }
    function wireCount(count: number) {
      db.db.select.mockReturnValueOnce(mockSelectRows([{ count }]));
    }

    it('returns counts split by periodStart vs deactivatedAt', async () => {
      wireFindActive([activeRow]);
      wireCount(3); // after (periodStart > deactivatedAt)
      wireCount(2); // before (periodStart <= deactivatedAt)

      const result = await service.previewDeactivation('c1', 'l1', pastDate);

      expect(result).toEqual({
        registrationId: 'reg1',
        deactivatedAt: pastDate.toISOString(),
        cancelledAfter: 3,
        remainingBefore: 2,
      });
    });

    it('rejects a future deactivatedAt', async () => {
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await expect(service.previewDeactivation('c1', 'l1', future))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException when the registration is not active', async () => {
      wireFindActive([]);
      await expect(service.previewDeactivation('c1', 'l1', pastDate))
        .rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deactivate', () => {
    const deactivatedAt = new Date('2026-03-01T00:00:00Z');

    function mockTx(opts: { afterFilings: Array<{ id: string; status: string }>; beforeFilings?: Array<{ id: string; status: string }> }) {
      let selectCall = 0;
      const tx = {
        update: vi.fn(() => ({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) })),
        select: vi.fn(() => {
          const chain: AnyChain = {} as AnyChain;
          chain.from = vi.fn().mockReturnValue(chain);
          chain.where = vi.fn(() => {
            const callIdx = selectCall++;
            const rows = callIdx === 0 ? opts.afterFilings : (opts.beforeFilings ?? []);
            return Promise.resolve(rows);
          });
          return chain;
        }),
      };
      return tx;
    }

    it('rejects future deactivatedAt up front', async () => {
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await expect(service.deactivate('c1', 'l1', {
        deactivatedAt: future,
        actorId: 'u1',
      })).rejects.toBeInstanceOf(BadRequestException);
      expect(db.db.transaction).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when no active registration exists', async () => {
      db.db.select.mockReturnValueOnce(mockSelectRows([]));
      await expect(service.deactivate('c1', 'l1', {
        deactivatedAt,
        actorId: 'u1',
      })).rejects.toBeInstanceOf(NotFoundException);
      expect(db.db.transaction).not.toHaveBeenCalled();
    });

    it('cancels post-effective-date filings, keeps earlier-period ones, emits event', async () => {
      db.db.select.mockReturnValueOnce(mockSelectRows([activeRow]));
      const tx = mockTx({
        afterFilings: [
          { id: 'f-after-1', status: 'pending' },
          { id: 'f-after-2', status: 'in_progress' },
        ],
      });
      db.db.transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));

      const result = await service.deactivate('c1', 'l1', {
        deactivatedAt,
        actorId: 'u1',
        comment: 'engagement ended',
      });

      expect(result.autoCancelledFilingIds).toEqual(['f-after-1', 'f-after-2']);
      expect(result.manuallyCancelledFilingIds).toEqual([]);
      // Cascade delegated to shared helper — auto path with distinct reason
      expect(filingsCancellation.cancelFilings).toHaveBeenCalledWith(
        tx,
        [
          { id: 'f-after-1', status: 'pending' },
          { id: 'f-after-2', status: 'in_progress' },
        ],
        expect.objectContaining({
          reason: 'Registration deactivated',
          actorId: 'u1',
        }),
      );
      // Event emitted once, payload includes both id lists
      expect(events.emitDynamic).toHaveBeenCalledTimes(1);
      expect(events.emitDynamic).toHaveBeenCalledWith(
        'compliance.RegistrationDeactivated',
        expect.objectContaining({
          entityType: 'client-registrations',
          entityId: 'reg1',
          payload: expect.objectContaining({
            autoCancelledFilingIds: ['f-after-1', 'f-after-2'],
            manuallyCancelledFilingIds: [],
            comment: 'engagement ended',
          }),
        }),
      );
    });

    it('also cancels earlier-period filings when alsoCancelEarlier is true, with distinct reason', async () => {
      db.db.select.mockReturnValueOnce(mockSelectRows([activeRow]));
      const tx = mockTx({
        afterFilings: [{ id: 'f-after-1', status: 'pending' }],
        beforeFilings: [{ id: 'f-before-1', status: 'in_progress' }],
      });
      db.db.transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));

      const result = await service.deactivate('c1', 'l1', {
        deactivatedAt,
        actorId: 'u1',
        alsoCancelEarlier: true,
      });

      expect(result.autoCancelledFilingIds).toEqual(['f-after-1']);
      expect(result.manuallyCancelledFilingIds).toEqual(['f-before-1']);
      expect(filingsCancellation.cancelFilings).toHaveBeenCalledWith(
        tx,
        [{ id: 'f-before-1', status: 'in_progress' }],
        expect.objectContaining({
          reason: 'Registration deactivation cleanup',
        }),
      );
    });

    it('is a no-op on downstream filings when none exist but still flips the registration and emits', async () => {
      db.db.select.mockReturnValueOnce(mockSelectRows([activeRow]));
      const tx = mockTx({ afterFilings: [] });
      db.db.transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));

      const result = await service.deactivate('c1', 'l1', {
        deactivatedAt,
        actorId: 'u1',
      });

      expect(result.autoCancelledFilingIds).toEqual([]);
      expect(result.manuallyCancelledFilingIds).toEqual([]);
      // Helper is still called (with empty arrays) — it no-ops on zero length
      expect(filingsCancellation.cancelFilings).toHaveBeenCalledWith(tx, [], expect.any(Object));
      expect(events.emitDynamic).toHaveBeenCalledTimes(1);
    });
  });

  describe('getRegisteredClients', () => {
    it('returns mapped active registrations for the law (joined with active clients)', async () => {
      // Joined shape: SELECT returns { registration: <row> } after innerJoin on clients
      db.db.select.mockReturnValue(
        mockSelectRows([
          { registration: activeRow },
          { registration: { ...activeRow, id: 'reg2', clientId: 'c2' } },
        ]),
      );

      const result = await service.getRegisteredClients('l1');

      expect(result).toHaveLength(2);
      expect(result[0]?.clientId).toBe('c1');
      expect(result[1]?.clientId).toBe('c2');
    });
  });

  describe('getRegisteredLaws', () => {
    it('returns mapped active registrations for the client', async () => {
      db.db.select.mockReturnValue(
        mockSelectRows([activeRow, { ...activeRow, id: 'reg3', lawId: 'l2' }]),
      );

      const result = await service.getRegisteredLaws('c1');

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.lawId)).toEqual(['l1', 'l2']);
    });

    it('returns empty array when client has no registrations', async () => {
      db.db.select.mockReturnValue(mockSelectRows([]));
      expect(await service.getRegisteredLaws('c1')).toEqual([]);
    });
  });
});
