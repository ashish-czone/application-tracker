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
  // After the workflow-lift, the service no longer injects EntityService.
  // CRUD goes through `crud` (BaseCrudService). Workflow ops go through
  // `workflowEngine` + `workflowRegistry` from @packages/workflows.
  let crud: {
    list: ReturnType<typeof vi.fn>;
    findOneOrFail: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
  };
  let workflowEngine: {
    validateAndThrow: ReturnType<typeof vi.fn>;
    recordHistory: ReturnType<typeof vi.fn>;
  };
  let workflowRegistry: { getByEntityField: ReturnType<typeof vi.fn> };
  let db: { db: { transaction: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> } };
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

  const baseClient = { id: 'cid-1', name: 'Acme', complianceStatus: 'active' };
  const validatedTransition = {
    transitionId: 'trans-1',
    transitionName: 'Dormantise',
    workflowDefinitionId: 'def-clients',
    workflowName: 'Compliance Client Status',
    fieldName: 'complianceStatus',
  };
  const workflowDef = { slug: 'compliance-client-status' } as never;

  beforeEach(() => {
    crud = {
      list: vi.fn(),
      findOneOrFail: vi.fn().mockResolvedValue(baseClient),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
    };
    workflowEngine = {
      validateAndThrow: vi.fn().mockResolvedValue(validatedTransition),
      recordHistory: vi.fn().mockResolvedValue({ historyId: 'h1', recordedAt: '2026-04-30T00:00:00Z' }),
    };
    workflowRegistry = {
      getByEntityField: vi.fn().mockReturnValue(workflowDef),
    };
    db = {
      db: {
        transaction: vi.fn(),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
        }),
        select: vi.fn(),
      },
    };
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
      crud as never,
      db as never,
      events as never,
      workflowEngine as never,
      workflowRegistry as never,
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
    // Clients has no `dataAccess` config so list/summary/handlerOptions
    // call rollup with `undefined` scope. Pre-lift these used to round-trip
    // through `entityService.getScopePredicate(ctx)` which always returned
    // undefined — same result, fewer hops.
    it('list delegates to ClientsRollupService.list with undefined scope', async () => {
      await service.list({ page: 1, limit: 25 } as never);
      expect(rollup.list).toHaveBeenCalledWith({ page: 1, limit: 25 }, undefined);
    });

    it('getSummary delegates to ClientsRollupService.getSummary with undefined scope', async () => {
      const ctx = { userId: 'u1', scopes: [{ type: 'any' }] } as never;
      await service.getSummary(ctx);
      expect(rollup.getSummary).toHaveBeenCalledWith(undefined);
    });

    it('getHandlerOptions delegates to ClientsRollupService.getHandlerOptions with undefined scope', async () => {
      const ctx = { userId: 'u1', scopes: [{ type: 'any' }] } as never;
      await service.getHandlerOptions(ctx);
      expect(rollup.getHandlerOptions).toHaveBeenCalledWith(undefined);
    });

    describe('getOptions', () => {
      function mockSelectChain(rows: unknown[]) {
        const chain = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue(rows),
        };
        db.db.select = vi.fn().mockReturnValue(chain);
        return chain;
      }

      it('returns rows from the select chain limited to the requested limit', async () => {
        const chain = mockSelectChain([
          { id: 'c1', name: 'Acme' },
          { id: 'c2', name: 'Beta' },
        ]);
        const result = await service.getOptions({ limit: 25 });
        expect(result).toEqual([
          { id: 'c1', name: 'Acme' },
          { id: 'c2', name: 'Beta' },
        ]);
        expect(chain.limit).toHaveBeenCalledWith(25);
      });

      it('passes a where clause when search is provided', async () => {
        const chain = mockSelectChain([]);
        await service.getOptions({ limit: 25, search: 'acm' });
        expect(chain.where).toHaveBeenCalled();
      });

      it('hydrates labels by id when ids are provided (search is ignored)', async () => {
        const chain = mockSelectChain([{ id: 'c1', name: 'Acme' }]);
        await service.getOptions({ limit: 25, ids: ['c1', 'c2'], search: 'acm' });
        expect(chain.where).toHaveBeenCalled();
      });
    });

    it('findOne delegates to crud.findOneOrFail', () => {
      service.findOne('cid-1', { userId: 'u1' } as never);
      expect(crud.findOneOrFail).toHaveBeenCalledWith('cid-1', { userId: 'u1' });
    });

    it('create pre-fills complianceStatus with the workflow initialState and stamps createdBy before delegating to crud.create', () => {
      service.create({ name: 'Acme' }, 'user-1');
      // Workflow state is system-managed: the service unconditionally stamps
      // `complianceStatus = CLIENTS_WORKFLOW.initialState` ('onboarding')
      // before delegating. See `.claude/rules/workflow-entity-creates.md`.
      // `createdBy` is `notNull()` on the shared `clients` table and
      // BaseCrudService doesn't auto-stamp it — the service is responsible.
      expect(crud.create).toHaveBeenCalledWith(
        { name: 'Acme', createdBy: 'user-1', complianceStatus: 'onboarding' },
        'user-1',
      );
    });

    it('update delegates to crud.update', () => {
      const accessCtx = { userId: 'u1' } as never;
      service.update('cid-1', { name: 'Acme 2' }, 'user-1', accessCtx);
      expect(crud.update).toHaveBeenCalledWith('cid-1', { name: 'Acme 2' }, 'user-1', accessCtx);
    });

    it('softDelete delegates to crud.softDelete', () => {
      service.softDelete('cid-1', 'user-1');
      expect(crud.softDelete).toHaveBeenCalledWith('cid-1', 'user-1', undefined);
    });
  });

  describe('transition', () => {
    // After the workflow-lift, the service no longer goes through
    // EntityService. It loads the entity itself, calls
    // `workflowEngine.validateAndThrow`, then writes the column update +
    // `recordHistory` row inside a single tx (with the dormancy cascade
    // composed in for active → dormant on status). Dormancy hooks still
    // receive a TransitionContext-shaped object — built inline from the
    // engine's ValidatedTransition return.
    function makeTx() {
      return {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
        }),
      };
    }

    it('runs load → validate → tx(update + recordHistory) → emit for a non-dormantisation transition', async () => {
      crud.findOneOrFail.mockResolvedValue({ id: 'cid-1', name: 'Acme', complianceStatus: 'onboarding' });
      const tx = makeTx();
      db.db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));

      await service.transition('cid-1', 'status', 'active', 'user-1');

      // Engine call uses the translated column key, not the caller-facing alias.
      expect(workflowEngine.validateAndThrow).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowSlug: 'compliance-client-status',
          entityType: 'clients',
          entityId: 'cid-1',
          fromState: 'onboarding',
          toState: 'active',
          actorId: 'user-1',
        }),
      );
      expect(workflowEngine.recordHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'clients',
          entityId: 'cid-1',
          fromState: 'onboarding',
          toState: 'active',
        }),
        tx,
      );
      expect(dormancy.cancelInFlightFilings).not.toHaveBeenCalled();
      expect(events.emitDynamic).toHaveBeenCalledWith(
        'clients.ComplianceStatusChanged',
        expect.objectContaining({
          entityType: 'clients',
          entityId: 'cid-1',
          actorId: 'user-1',
          payload: expect.objectContaining({ fromState: 'onboarding', toState: 'active' }),
        }),
      );
      expect(dormancy.emitCascadeEvent).not.toHaveBeenCalled();
    });

    it('runs dormancy cascade inside the same tx when active → dormant on status', async () => {
      crud.findOneOrFail.mockResolvedValue({ id: 'cid-1', name: 'Acme', complianceStatus: 'active' });
      dormancy.cancelInFlightFilings.mockResolvedValue({ cancelledFilingIds: ['f1', 'f2'] });
      const tx = makeTx();
      db.db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));

      await service.transition('cid-1', 'status', 'dormant', 'user-1', { reason: 'Ceased' });

      expect(dormancy.cancelInFlightFilings).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'cid-1',
          fromState: 'active',
          toState: 'dormant',
          reason: 'Ceased',
        }),
        tx,
      );
      expect(dormancy.sweepLateFilings).toHaveBeenCalledWith('cid-1');
      expect(dormancy.emitCascadeEvent).toHaveBeenCalledWith(
        expect.objectContaining({ fromState: 'active', toState: 'dormant' }),
        ['f1', 'f2'],
      );
    });

    it('post-commit late-filing sweep folds straggler IDs into the cascade event', async () => {
      crud.findOneOrFail.mockResolvedValue({ id: 'cid-1', name: 'Acme', complianceStatus: 'active' });
      dormancy.cancelInFlightFilings.mockResolvedValue({ cancelledFilingIds: ['f1'] });
      dormancy.sweepLateFilings.mockResolvedValue({ cancelledFilingIds: ['f-late-1', 'f-late-2'] });
      const tx = makeTx();
      db.db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));

      await service.transition('cid-1', 'status', 'dormant', 'user-1');

      // The sweep runs AFTER the tx commits — assert ordering by call index.
      const cascadeCallOrder = dormancy.cancelInFlightFilings.mock.invocationCallOrder[0];
      const sweepCallOrder = dormancy.sweepLateFilings.mock.invocationCallOrder[0];
      const emitCallOrder = dormancy.emitCascadeEvent.mock.invocationCallOrder[0];
      expect(cascadeCallOrder).toBeLessThan(sweepCallOrder);
      expect(sweepCallOrder).toBeLessThan(emitCallOrder);

      // Late stragglers concatenated onto the cascade event payload.
      expect(dormancy.emitCascadeEvent).toHaveBeenCalledWith(
        expect.objectContaining({ fromState: 'active', toState: 'dormant' }),
        ['f1', 'f-late-1', 'f-late-2'],
      );
    });

    it('does not run cascade on dormant → active', async () => {
      crud.findOneOrFail.mockResolvedValue({ id: 'cid-1', name: 'Acme', complianceStatus: 'dormant' });
      const tx = makeTx();
      db.db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));

      await service.transition('cid-1', 'status', 'active', 'user-1');

      expect(dormancy.cancelInFlightFilings).not.toHaveBeenCalled();
      expect(dormancy.emitCascadeEvent).not.toHaveBeenCalled();
    });

    it('does not run cascade on a non-status field flipping to dormant', async () => {
      crud.findOneOrFail.mockResolvedValue({ id: 'cid-1', name: 'Acme', other: 'active' });
      const tx = makeTx();
      db.db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(tx));

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
