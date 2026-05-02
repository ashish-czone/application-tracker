import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ClientsService, type ContactInput } from '../clients.service';

type AnyChain = Record<string, ReturnType<typeof vi.fn>>;

function mockInsertReturning(rows: unknown[]) {
  const chain: AnyChain = {} as AnyChain;
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue(rows);
  return chain;
}

interface TxMock {
  insert: ReturnType<typeof vi.fn>;
}

function makeTx(clientRow: unknown, contactRows: unknown[]): TxMock {
  const clientInsert = mockInsertReturning([clientRow]);
  const contactInsert = mockInsertReturning(contactRows);
  const insert = vi.fn()
    .mockReturnValueOnce(clientInsert)
    .mockReturnValueOnce(contactInsert);
  return { insert };
}

describe('ClientsService', () => {
  let entityService: {
    list: ReturnType<typeof vi.fn>;
    findOneOrFail: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
    clone: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
    getListLayout: ReturnType<typeof vi.fn>;
    validateTransition: ReturnType<typeof vi.fn>;
    applyTransition: ReturnType<typeof vi.fn>;
    emitTransitionEvent: ReturnType<typeof vi.fn>;
    getScopePredicate: ReturnType<typeof vi.fn>;
  };
  let db: { db: { transaction: ReturnType<typeof vi.fn> } };
  let events: { emitDynamic: ReturnType<typeof vi.fn> };
  let dormancy: {
    cancelInFlightFilings: ReturnType<typeof vi.fn>;
    sweepLateFilings: ReturnType<typeof vi.fn>;
    emitCascadeEvent: ReturnType<typeof vi.fn>;
    countNonTerminalFilings: ReturnType<typeof vi.fn>;
  };
  let contacts: { hasPrimaryContact: ReturnType<typeof vi.fn> };
  let rollup: {
    list: ReturnType<typeof vi.fn>;
    getSummary: ReturnType<typeof vi.fn>;
    getHandlerOptions: ReturnType<typeof vi.fn>;
  };
  let service: ClientsService;

  beforeEach(() => {
    entityService = {
      list: vi.fn(),
      findOneOrFail: vi.fn().mockResolvedValue({ id: 'cid-1', status: 'dormant' }),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      clone: vi.fn(),
      restore: vi.fn(),
      getListLayout: vi.fn(),
      validateTransition: vi.fn(),
      applyTransition: vi.fn().mockResolvedValue(undefined),
      emitTransitionEvent: vi.fn(),
      getScopePredicate: vi.fn().mockResolvedValue(undefined),
    };
    db = { db: { transaction: vi.fn() } };
    events = { emitDynamic: vi.fn() };
    dormancy = {
      cancelInFlightFilings: vi.fn().mockResolvedValue({ cancelledFilingIds: [] }),
      sweepLateFilings: vi.fn().mockResolvedValue({ cancelledFilingIds: [] }),
      emitCascadeEvent: vi.fn(),
      countNonTerminalFilings: vi.fn().mockResolvedValue(0),
    };
    contacts = { hasPrimaryContact: vi.fn().mockResolvedValue(true) };
    rollup = {
      list: vi.fn().mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 25, totalPages: 0 } }),
      getSummary: vi.fn().mockResolvedValue({
        total: 0,
        byStatus: { active: 0, onboarding: 0, dormant: 0 },
        byRisk: { healthy: 0, 'at-risk': 0, critical: 0 },
        totalOverdue: 0,
        clientsWithOverdue: 0,
      }),
      getHandlerOptions: vi.fn().mockResolvedValue([]),
    };
    service = new ClientsService(
      entityService as never,
      db as never,
      events as never,
      dormancy as never,
      contacts as never,
      rollup as never,
    );
  });

  const validClient = {
    name: 'Acme',
    legalName: 'Acme Pvt. Ltd.',
  };
  const primaryContact: ContactInput = { fullName: 'Alice', complianceIsPrimary: true };
  const secondaryContact: ContactInput = { fullName: 'Bob', complianceIsPrimary: false };

  describe('CRUD delegates', () => {
    it('list delegates to ClientsRollupService.list with the translated params and no scope when no accessCtx', async () => {
      await service.list({ page: 1, limit: 25 } as never);
      expect(rollup.list).toHaveBeenCalledWith({ page: 1, limit: 25 }, undefined);
    });

    it('list passes the actor scope predicate from EntityService through to the rollup', async () => {
      const scopePredicate = { __tag: 'scope-sql' };
      entityService.getScopePredicate.mockResolvedValueOnce(scopePredicate);
      const ctx = { userId: 'u1', scopes: [{ type: 'unit' }] } as never;
      await service.list({ page: 1, limit: 25 } as never, ctx);
      expect(entityService.getScopePredicate).toHaveBeenCalledWith(ctx);
      expect(rollup.list).toHaveBeenCalledWith({ page: 1, limit: 25 }, scopePredicate);
    });

    it('getSummary delegates to ClientsRollupService.getSummary with the scope predicate', async () => {
      const scopePredicate = { __tag: 'sum-sql' };
      entityService.getScopePredicate.mockResolvedValueOnce(scopePredicate);
      const ctx = { userId: 'u1', scopes: [{ type: 'any' }] } as never;
      await service.getSummary(ctx);
      expect(rollup.getSummary).toHaveBeenCalledWith(scopePredicate);
    });

    it('getHandlerOptions delegates to ClientsRollupService.getHandlerOptions with the scope predicate', async () => {
      const scopePredicate = { __tag: 'handler-sql' };
      entityService.getScopePredicate.mockResolvedValueOnce(scopePredicate);
      const ctx = { userId: 'u1', scopes: [{ type: 'any' }] } as never;
      await service.getHandlerOptions(ctx);
      expect(rollup.getHandlerOptions).toHaveBeenCalledWith(scopePredicate);
    });

    it('findOne delegates to entityService.findOneOrFail', () => {
      service.findOne('cid-1', { userId: 'u1' } as never);
      expect(entityService.findOneOrFail).toHaveBeenCalledWith('cid-1', { userId: 'u1' });
    });

    it('create pre-fills complianceStatus with the workflow initialState and delegates to entityService.create', () => {
      service.create({ name: 'Acme' }, 'user-1');
      // Workflow state is system-managed: the service unconditionally stamps
      // `complianceStatus = CLIENTS_WORKFLOW.initialState` ('onboarding')
      // before delegating. See `.claude/rules/workflow-entity-creates.md`.
      expect(entityService.create).toHaveBeenCalledWith(
        { name: 'Acme', complianceStatus: 'onboarding' },
        'user-1',
      );
    });

    it('update delegates to entityService.update', () => {
      const accessCtx = { userId: 'u1' } as never;
      service.update('cid-1', { name: 'Acme 2' }, 'user-1', accessCtx);
      expect(entityService.update).toHaveBeenCalledWith('cid-1', { name: 'Acme 2' }, 'user-1', accessCtx);
    });

    it('softDelete delegates to entityService.softDelete', () => {
      service.softDelete('cid-1', 'user-1');
      expect(entityService.softDelete).toHaveBeenCalledWith('cid-1', 'user-1', undefined);
    });

    it('clone delegates to entityService.clone', () => {
      service.clone('cid-1', 'user-1');
      expect(entityService.clone).toHaveBeenCalledWith('cid-1', 'user-1');
    });

    it('restore delegates to entityService.restore', () => {
      service.restore('cid-1');
      expect(entityService.restore).toHaveBeenCalledWith('cid-1');
    });

    it('getListLayout delegates to entityService.getListLayout', () => {
      service.getListLayout();
      expect(entityService.getListLayout).toHaveBeenCalled();
    });
  });

  describe('transition', () => {
    // After the C-2 fold, the service translates the controller-side
    // `fieldKey: 'status'` to the column key `complianceStatus` before
    // calling the entity engine. The TransitionContext returned by the
    // engine therefore carries `complianceStatus` — that's what dormantisation
    // detection compares against.
    const baseCtx = {
      entityType: 'clients',
      entityId: 'cid-1',
      fieldKey: 'complianceStatus',
      fieldName: 'complianceStatus',
      fromState: 'onboarding',
      toState: 'active',
      transitionId: 't-1',
      transitionName: 'activate',
      workflowDefinitionId: 'wf-1',
      workflowSlug: 'client-status',
      actorId: 'user-1',
      entity: { id: 'cid-1', name: 'Acme' },
    };

    it('runs validate → tx(apply) → emit for a non-dormantisation transition', async () => {
      entityService.findOneOrFail.mockResolvedValue({ id: 'cid-1', complianceStatus: 'onboarding' });
      entityService.validateTransition.mockResolvedValue(baseCtx);
      db.db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb({}));

      await service.transition('cid-1', 'status', 'active', 'user-1');

      // Engine call uses the translated column key, not the caller-facing alias.
      expect(entityService.validateTransition).toHaveBeenCalledWith('cid-1', 'complianceStatus', 'active', 'user-1', undefined, undefined);
      expect(entityService.applyTransition).toHaveBeenCalledWith(baseCtx, {});
      expect(dormancy.cancelInFlightFilings).not.toHaveBeenCalled();
      expect(entityService.emitTransitionEvent).toHaveBeenCalledWith(baseCtx);
      expect(dormancy.emitCascadeEvent).not.toHaveBeenCalled();
    });

    it('runs dormancy cascade inside the same tx when active → dormant on status', async () => {
      const dormantCtx = { ...baseCtx, fromState: 'active', toState: 'dormant' };
      entityService.findOneOrFail.mockResolvedValue({ id: 'cid-1', complianceStatus: 'active' });
      entityService.validateTransition.mockResolvedValue(dormantCtx);
      dormancy.cancelInFlightFilings.mockResolvedValue({ cancelledFilingIds: ['f1', 'f2'] });
      let applyCalled = false;
      let cascadeCalled = false;
      db.db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
        const tx = {};
        entityService.applyTransition.mockImplementationOnce(() => {
          applyCalled = true;
          expect(cascadeCalled).toBe(false);
          return Promise.resolve();
        });
        dormancy.cancelInFlightFilings.mockImplementationOnce(() => {
          cascadeCalled = true;
          expect(applyCalled).toBe(true);
          return Promise.resolve({ cancelledFilingIds: ['f1', 'f2'] });
        });
        return cb(tx);
      });

      await service.transition('cid-1', 'status', 'dormant', 'user-1', { reason: 'Ceased' });

      expect(applyCalled).toBe(true);
      expect(cascadeCalled).toBe(true);
      expect(dormancy.sweepLateFilings).toHaveBeenCalledWith('cid-1');
      expect(dormancy.emitCascadeEvent).toHaveBeenCalledWith(dormantCtx, ['f1', 'f2']);
    });

    it('post-commit late-filing sweep folds straggler IDs into the cascade event', async () => {
      const dormantCtx = { ...baseCtx, fromState: 'active', toState: 'dormant' };
      entityService.findOneOrFail.mockResolvedValue({ id: 'cid-1', complianceStatus: 'active' });
      entityService.validateTransition.mockResolvedValue(dormantCtx);
      dormancy.cancelInFlightFilings.mockResolvedValue({ cancelledFilingIds: ['f1'] });
      dormancy.sweepLateFilings.mockResolvedValue({ cancelledFilingIds: ['f-late-1', 'f-late-2'] });
      db.db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb({}));

      await service.transition('cid-1', 'status', 'dormant', 'user-1');

      // The sweep runs AFTER the tx commits — assert ordering by call index.
      const cascadeCallOrder = dormancy.cancelInFlightFilings.mock.invocationCallOrder[0];
      const sweepCallOrder = dormancy.sweepLateFilings.mock.invocationCallOrder[0];
      const emitCallOrder = dormancy.emitCascadeEvent.mock.invocationCallOrder[0];
      expect(cascadeCallOrder).toBeLessThan(sweepCallOrder);
      expect(sweepCallOrder).toBeLessThan(emitCallOrder);

      // Late stragglers concatenated onto the cascade event payload.
      expect(dormancy.emitCascadeEvent).toHaveBeenCalledWith(
        dormantCtx,
        ['f1', 'f-late-1', 'f-late-2'],
      );
    });

    it('does not run cascade on dormant → active', async () => {
      const reactivate = { ...baseCtx, fromState: 'dormant', toState: 'active' };
      entityService.findOneOrFail.mockResolvedValue({ id: 'cid-1', complianceStatus: 'dormant' });
      entityService.validateTransition.mockResolvedValue(reactivate);
      db.db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb({}));

      await service.transition('cid-1', 'status', 'active', 'user-1');

      expect(dormancy.cancelInFlightFilings).not.toHaveBeenCalled();
      expect(dormancy.emitCascadeEvent).not.toHaveBeenCalled();
    });

    it('does not run cascade on a non-status field flipping to dormant', async () => {
      const other = { ...baseCtx, fieldKey: 'other', fieldName: 'other', fromState: 'active', toState: 'dormant' };
      entityService.validateTransition.mockResolvedValue(other);
      db.db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb({}));

      await service.transition('cid-1', 'other', 'dormant', 'user-1');

      expect(dormancy.cancelInFlightFilings).not.toHaveBeenCalled();
    });
  });

  describe('createWithContacts', () => {
    it('inserts client + contacts in a single transaction and returns both', async () => {
      const clientRow = {
        id: 'cid-1',
        name: 'Acme',
        legalName: 'Acme Pvt. Ltd.',
        complianceStatus: 'onboarding',
        createdAt: new Date('2026-01-01'),
      };
      const contactRows = [
        { id: 'ct-1', complianceClientId: 'cid-1', fullName: 'Alice', complianceIsPrimary: true },
        { id: 'ct-2', complianceClientId: 'cid-1', fullName: 'Bob', complianceIsPrimary: false },
      ];

      const tx = makeTx(clientRow, contactRows);
      db.db.transaction.mockImplementation(async (cb: (tx: TxMock) => unknown) => cb(tx));

      const result = await service.createWithContacts({
        client: validClient,
        contacts: [primaryContact, secondaryContact],
      });

      expect(db.db.transaction).toHaveBeenCalledTimes(1);
      expect(tx.insert).toHaveBeenCalledTimes(2);
      expect(result.client.id).toBe('cid-1');
      expect(result.contacts).toHaveLength(2);
      expect(result.contacts[0].isPrimary).toBe(true);
    });

    it('defaults status to onboarding when not provided', async () => {
      const clientRow = { id: 'cid-1', name: 'Acme', legalName: 'Acme', complianceStatus: 'onboarding', createdAt: new Date() };
      const tx = makeTx(clientRow, [{ id: 'ct-1', complianceClientId: 'cid-1', fullName: 'Alice', complianceIsPrimary: true }]);
      db.db.transaction.mockImplementation(async (cb: (tx: TxMock) => unknown) => cb(tx));

      await service.createWithContacts({ client: validClient, contacts: [primaryContact] });

      const clientInsertValues = (tx.insert.mock.results[0].value as AnyChain).values.mock.calls[0][0] as Record<string, unknown>;
      expect(clientInsertValues.complianceStatus).toBe('onboarding');
    });

    it('throws BadRequest when contacts is empty', async () => {
      await expect(
        service.createWithContacts({ client: validClient, contacts: [] }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(db.db.transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequest when zero contacts are flagged primary', async () => {
      await expect(
        service.createWithContacts({
          client: validClient,
          contacts: [{ fullName: 'Alice' }, { fullName: 'Bob' }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequest when multiple contacts are flagged primary', async () => {
      await expect(
        service.createWithContacts({
          client: validClient,
          contacts: [
            { fullName: 'Alice', complianceIsPrimary: true },
            { fullName: 'Bob', complianceIsPrimary: true },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('forwards the clientId from the inserted client row into each contact', async () => {
      const clientRow = { id: 'cid-xyz', name: 'Acme', legalName: 'Acme', complianceStatus: 'onboarding', createdAt: new Date() };
      const tx = makeTx(clientRow, [{ id: 'ct-1', complianceClientId: 'cid-xyz', fullName: 'Alice', complianceIsPrimary: true }]);
      db.db.transaction.mockImplementation(async (cb: (tx: TxMock) => unknown) => cb(tx));

      await service.createWithContacts({ client: validClient, contacts: [primaryContact] });

      const contactInsertValues = (tx.insert.mock.results[1].value as AnyChain).values.mock.calls[0][0] as Array<Record<string, unknown>>;
      expect(contactInsertValues).toHaveLength(1);
      expect(contactInsertValues[0].complianceClientId).toBe('cid-xyz');
    });

    it('emits clients.Created and one client-contacts.Created per contact', async () => {
      const clientRow = { id: 'cid-1', name: 'Acme', legalName: 'Acme', complianceStatus: 'onboarding', createdAt: new Date() };
      const contactRows = [
        { id: 'ct-1', complianceClientId: 'cid-1', fullName: 'Alice', complianceIsPrimary: true },
        { id: 'ct-2', complianceClientId: 'cid-1', fullName: 'Bob', complianceIsPrimary: false },
      ];
      const tx = makeTx(clientRow, contactRows);
      db.db.transaction.mockImplementation(async (cb: (tx: TxMock) => unknown) => cb(tx));

      await service.createWithContacts(
        { client: validClient, contacts: [primaryContact, secondaryContact] },
        'user-1',
      );

      expect(events.emitDynamic).toHaveBeenCalledTimes(3);
      expect(events.emitDynamic).toHaveBeenNthCalledWith(1, 'clients.Created', expect.objectContaining({
        entityType: 'clients',
        entityId: 'cid-1',
        actorId: 'user-1',
        payload: expect.objectContaining({ after: clientRow }),
      }));
      expect(events.emitDynamic).toHaveBeenNthCalledWith(2, 'client-contacts.Created', expect.objectContaining({
        entityType: 'client-contacts',
        entityId: 'ct-1',
      }));
      expect(events.emitDynamic).toHaveBeenNthCalledWith(3, 'client-contacts.Created', expect.objectContaining({
        entityType: 'client-contacts',
        entityId: 'ct-2',
      }));
    });

    it('does not emit when validation fails', async () => {
      await expect(
        service.createWithContacts({ client: validClient, contacts: [] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(events.emitDynamic).not.toHaveBeenCalled();
    });
  });
});
