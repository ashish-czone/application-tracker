import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../users.service';

vi.mock('@packages/tenancy/helpers', () => ({
  withTenant: vi.fn((_table: any, ...conditions: any[]) => conditions[0] ?? true),
  withTenantInsert: vi.fn((_table: any, values: any) => values),
}));

/**
 * Build a db mock where:
 *   - select().from().where().limit() resolves to a queue of rows, one per call
 *   - update().set().where() resolves successfully
 *   - transaction(cb) runs cb with a tx object that proxies insert + update through
 *
 * `selectQueue` lets tests simulate "uniqueness check returns empty" then
 * "load-after-insert returns user row" in sequence.
 */
function createMockDb(options: { selectQueue?: unknown[][]; insertReturning?: unknown[] } = {}) {
  const selectQueue = [...(options.selectQueue ?? [])];
  const insertReturning = options.insertReturning ?? [{ id: 'new-user', email: 'new@test.com' }];

  const selectChain: any = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(async () => selectQueue.shift() ?? []),
  };

  const updateChain = {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  };

  const insertChain = {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(insertReturning),
    }),
  };

  const txSelectChain: any = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(async () => selectQueue.shift() ?? []),
  };

  const tx = {
    select: vi.fn().mockReturnValue(txSelectChain),
    insert: vi.fn().mockReturnValue(insertChain),
    update: vi.fn().mockReturnValue(updateChain),
  };

  const db = {
    select: vi.fn().mockReturnValue(selectChain),
    update: vi.fn().mockReturnValue(updateChain),
    transaction: vi.fn().mockImplementation(async (cb: any) => cb(tx)),
  };

  return { db, _selectChain: selectChain, _updateChain: updateChain, _tx: tx, _insertChain: insertChain };
}

function createMockAuthService(overrides: Partial<Record<string, any>> = {}) {
  return {
    changePasswordDirect: vi.fn().mockResolvedValue(undefined),
    createInvitationToken: vi.fn().mockResolvedValue({ token: 'invite-token', expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }),
    ...overrides,
  };
}

function createMockRbacService(overrides: Partial<Record<string, any>> = {}) {
  return {
    assignRoleToUser: vi.fn().mockResolvedValue(undefined),
    getRolesByUserIds: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

function createMockEventEmitter() {
  return {
    emit: vi.fn(),
  };
}

type BuildServiceOptions = Parameters<typeof createMockDb>[0] & {
  rbac?: Partial<Record<string, any>>;
  positionsReader?: { getPositionsByUserIds: (ids: string[]) => Promise<Record<string, unknown[]>> };
};

function buildService(options: BuildServiceOptions = {}) {
  const { rbac, positionsReader, ...dbOptions } = options;
  const mockDb = createMockDb(dbOptions);
  const authService = createMockAuthService();
  const rbacService = createMockRbacService(rbac);
  const eventEmitter = createMockEventEmitter();
  const entityService = {
    list: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, pageCount: 0 } }),
    findOneOrFail: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    clone: vi.fn(),
    restore: vi.fn(),
    getListLayout: vi.fn(),
  } as any;
  const service = new UsersService(
    entityService,
    { db: mockDb.db } as any,
    authService as any,
    rbacService as any,
    eventEmitter as any,
    positionsReader,
  );
  return { service, mockDb, authService, rbacService, eventEmitter, entityService };
}

describe('UsersService (thin)', () => {
  describe('CRUD delegates', () => {
    it('list forwards query + accessCtx', async () => {
      const ctx = buildService();
      await ctx.service.list({ page: 1 } as never, { userId: 'u1' } as never);
      expect(ctx.entityService.list).toHaveBeenCalledWith({ page: 1 }, { userId: 'u1' });
    });

    it('findOne forwards id + accessCtx', async () => {
      const ctx = buildService();
      ctx.entityService.findOneOrFail.mockResolvedValue({ id: 'u1' });
      await ctx.service.findOne('u1', { userId: 'admin' } as never);
      expect(ctx.entityService.findOneOrFail).toHaveBeenCalledWith('u1', { userId: 'admin' });
    });

    it('create forwards input + actorId', async () => {
      const ctx = buildService();
      await ctx.service.create({ email: 'x@y.com' } as never, 'actor-1');
      expect(ctx.entityService.create).toHaveBeenCalledWith({ email: 'x@y.com' }, 'actor-1');
    });

    it('update forwards id + input + actorId + accessCtx', async () => {
      const ctx = buildService();
      await ctx.service.update('u1', { firstName: 'X' } as never, 'actor-1', { userId: 'admin' } as never);
      expect(ctx.entityService.update).toHaveBeenCalledWith('u1', { firstName: 'X' }, 'actor-1', { userId: 'admin' });
    });

    it('softDelete forwards id + actorId + accessCtx', async () => {
      const ctx = buildService();
      await ctx.service.softDelete('u1', 'actor-1', { userId: 'admin' } as never);
      expect(ctx.entityService.softDelete).toHaveBeenCalledWith('u1', 'actor-1', { userId: 'admin' });
    });

    it('clone forwards id + actorId', async () => {
      const ctx = buildService();
      await ctx.service.clone('u1', 'actor-1');
      expect(ctx.entityService.clone).toHaveBeenCalledWith('u1', 'actor-1');
    });

    it('restore forwards id', async () => {
      const ctx = buildService();
      await ctx.service.restore('u1');
      expect(ctx.entityService.restore).toHaveBeenCalledWith('u1');
    });

    it('getListLayout forwards to entityService', async () => {
      const ctx = buildService();
      await ctx.service.getListLayout();
      expect(ctx.entityService.getListLayout).toHaveBeenCalled();
    });
  });

  describe('getEmail', () => {
    it('returns the email for an active user', async () => {
      const ctx = buildService({ selectQueue: [[{ email: 'alice@example.com' }]] });
      const result = await ctx.service.getEmail('user-1');
      expect(result).toBe('alice@example.com');
    });

    it('returns null when the user is not found', async () => {
      const ctx = buildService({ selectQueue: [[]] });
      const result = await ctx.service.getEmail('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getPhone', () => {
    it('returns the phone for an active user', async () => {
      const ctx = buildService({ selectQueue: [[{ phone: '+15551234567' }]] });
      const result = await ctx.service.getPhone('user-1');
      expect(result).toBe('+15551234567');
    });

    it('returns null when the user has no phone', async () => {
      const ctx = buildService({ selectQueue: [[{ phone: null }]] });
      const result = await ctx.service.getPhone('user-1');
      expect(result).toBeNull();
    });

    it('returns null when the user is not found', async () => {
      const ctx = buildService({ selectQueue: [[]] });
      const result = await ctx.service.getPhone('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('resetPassword', () => {
    it('delegates to AuthService.changePasswordDirect for an existing user', async () => {
      const ctx = buildService({ selectQueue: [[{ id: 'user-1' }]] });

      await ctx.service.resetPassword('user-1', 'NewPass!234');

      expect(ctx.authService.changePasswordDirect).toHaveBeenCalledWith('user-1', 'NewPass!234');
    });

    it('throws NotFoundException when the user is not found', async () => {
      const ctx = buildService({ selectQueue: [[]] });

      await expect(ctx.service.resetPassword('ghost', 'NewPass!234'))
        .rejects.toThrow(NotFoundException);
      expect(ctx.authService.changePasswordDirect).not.toHaveBeenCalled();
    });

    it('does not call authService when the user is soft-deleted (filtered out)', async () => {
      // soft-deleted rows never match the active filter in the query, so the select returns []
      const ctx = buildService({ selectQueue: [[]] });

      await expect(ctx.service.resetPassword('deleted-user', 'NewPass!234'))
        .rejects.toThrow(NotFoundException);
      expect(ctx.authService.changePasswordDirect).not.toHaveBeenCalled();
    });
  });

  describe('inviteUser', () => {
    it('creates the user, mints a token, assigns roles, and emits AUTH_INVITATION_SENT', async () => {
      const ctx = buildService({
        // 1st select (uniqueness check): no existing
        // 2nd select (inside tx? no — tx opens after the check). Just one empty select queued.
        selectQueue: [[]],
        insertReturning: [{
          id: 'invited-user-1',
          email: 'new@test.com',
          phone: null,
          firstName: 'New',
          lastName: 'Invitee',
          userType: 'admin',
          invitedAt: new Date('2026-04-21T10:00:00Z'),
        }],
      });

      const result = await ctx.service.inviteUser({
        email: 'New@Test.com',
        firstName: 'New',
        lastName: 'Invitee',
        userType: 'admin',
        roleIds: ['role-1', 'role-2'],
      });

      expect(ctx.mockDb.db.transaction).toHaveBeenCalled();
      expect(ctx.mockDb._tx.insert).toHaveBeenCalled();
      const inserted = ctx.mockDb._insertChain.values.mock.calls[0][0];
      expect(inserted.email).toBe('new@test.com'); // lowercased
      expect(inserted.invitedAt).toBeInstanceOf(Date);

      expect(ctx.authService.createInvitationToken).toHaveBeenCalledWith('invited-user-1', ctx.mockDb._tx);

      expect(ctx.rbacService.assignRoleToUser).toHaveBeenCalledWith('invited-user-1', 'role-1');
      expect(ctx.rbacService.assignRoleToUser).toHaveBeenCalledWith('invited-user-1', 'role-2');

      expect(ctx.eventEmitter.emit).toHaveBeenCalledWith(
        'auth.InvitationSent',
        expect.objectContaining({
          entityType: 'users',
          entityId: 'invited-user-1',
          payload: expect.objectContaining({
            email: 'new@test.com',
            token: 'invite-token',
            userType: 'admin',
          }),
        }),
      );

      expect(result).toMatchObject({
        id: 'invited-user-1',
        email: 'new@test.com',
        userType: 'admin',
      });
    });

    it('throws ConflictException when an active user already exists with that email', async () => {
      const ctx = buildService({
        selectQueue: [[{ id: 'existing-user' }]], // uniqueness check finds a row
      });

      await expect(ctx.service.inviteUser({
        email: 'existing@test.com',
        firstName: 'E',
        lastName: 'U',
        userType: 'client',
      })).rejects.toThrow(ConflictException);

      expect(ctx.mockDb.db.transaction).not.toHaveBeenCalled();
      expect(ctx.authService.createInvitationToken).not.toHaveBeenCalled();
      expect(ctx.eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('works without roleIds (assigns none, still mints token + emits event)', async () => {
      const ctx = buildService({
        selectQueue: [[]],
        insertReturning: [{
          id: 'u1',
          email: 'solo@test.com',
          phone: null,
          firstName: 'Solo',
          lastName: 'User',
          userType: 'client',
          invitedAt: new Date(),
        }],
      });

      await ctx.service.inviteUser({
        email: 'solo@test.com',
        firstName: 'Solo',
        lastName: 'User',
        userType: 'client',
      });

      expect(ctx.rbacService.assignRoleToUser).not.toHaveBeenCalled();
      expect(ctx.authService.createInvitationToken).toHaveBeenCalled();
      expect(ctx.eventEmitter.emit).toHaveBeenCalled();
    });
  });

  describe('resendInvitation', () => {
    it('refreshes invitedAt, mints a fresh token, and emits AUTH_INVITATION_SENT', async () => {
      const ctx = buildService({
        selectQueue: [[{
          id: 'u1',
          email: 'pending@test.com',
          firstName: 'Pending',
          lastName: 'User',
          userType: 'client',
          invitedAt: new Date('2026-04-01T10:00:00Z'),
          acceptedAt: null,
        }]],
      });

      const result = await ctx.service.resendInvitation('u1');

      expect(ctx.mockDb.db.update).toHaveBeenCalled();
      const setArg = ctx.mockDb._updateChain.set.mock.calls[0][0];
      expect(setArg.invitedAt).toBeInstanceOf(Date);

      expect(ctx.authService.createInvitationToken).toHaveBeenCalledWith('u1');
      expect(ctx.eventEmitter.emit).toHaveBeenCalledWith('auth.InvitationSent', expect.anything());
      expect(result).toHaveProperty('expiresAt');
    });

    it('throws NotFoundException when the user does not exist', async () => {
      const ctx = buildService({ selectQueue: [[]] });

      await expect(ctx.service.resendInvitation('ghost'))
        .rejects.toThrow(NotFoundException);
      expect(ctx.authService.createInvitationToken).not.toHaveBeenCalled();
    });

    it('throws ConflictException when user has no invitedAt (was created with credentials)', async () => {
      const ctx = buildService({
        selectQueue: [[{
          id: 'u1',
          email: 'regular@test.com',
          firstName: 'Regular',
          lastName: 'User',
          userType: 'client',
          invitedAt: null,
          acceptedAt: null,
        }]],
      });

      await expect(ctx.service.resendInvitation('u1'))
        .rejects.toThrow(ConflictException);
      expect(ctx.authService.createInvitationToken).not.toHaveBeenCalled();
    });

    it('throws ConflictException when invitation already accepted', async () => {
      const ctx = buildService({
        selectQueue: [[{
          id: 'u1',
          email: 'accepted@test.com',
          firstName: 'Accepted',
          lastName: 'User',
          userType: 'client',
          invitedAt: new Date('2026-04-01T10:00:00Z'),
          acceptedAt: new Date('2026-04-02T10:00:00Z'),
        }]],
      });

      await expect(ctx.service.resendInvitation('u1'))
        .rejects.toThrow(ConflictException);
      expect(ctx.authService.createInvitationToken).not.toHaveBeenCalled();
    });
  });

  describe('read-side enrichment', () => {
    it('list derives status for each row (active / invited / deactivated)', async () => {
      const ctx = buildService();
      ctx.entityService.list.mockResolvedValue({
        data: [
          { id: 'a', deletedAt: null, invitedAt: null, acceptedAt: null },
          { id: 'b', deletedAt: null, invitedAt: new Date(), acceptedAt: null },
          { id: 'c', deletedAt: null, invitedAt: new Date(), acceptedAt: new Date() },
          { id: 'd', deletedAt: new Date(), invitedAt: null, acceptedAt: null },
        ],
        meta: {},
      });

      const result = await ctx.service.list({} as never);

      expect(result.data[0]?.status).toBe('active');
      expect(result.data[1]?.status).toBe('invited');
      expect(result.data[2]?.status).toBe('active');
      expect(result.data[3]?.status).toBe('deactivated');
    });

    it('findOne attaches status for the single row', async () => {
      const ctx = buildService();
      ctx.entityService.findOneOrFail.mockResolvedValue({ id: 'u1', deletedAt: null, invitedAt: new Date(), acceptedAt: null });
      const enriched = await ctx.service.findOne('u1');
      expect((enriched as any).status).toBe('invited');
    });

    it('list attaches roles per row via batch rbac reader', async () => {
      const ctx = buildService({
        rbac: {
          getRolesByUserIds: vi.fn(async (ids: string[]) => ({
            [ids[0]!]: [{ id: 'r1', name: 'Admin', userType: 'admin' }],
            [ids[1]!]: [],
          })),
        },
      });
      ctx.entityService.list.mockResolvedValue({
        data: [{ id: 'u1', email: 'a@b.com' }, { id: 'u2', email: 'c@d.com' }],
        meta: {},
      });

      const result = await ctx.service.list({} as never);

      expect(ctx.rbacService.getRolesByUserIds).toHaveBeenCalledOnce();
      expect(ctx.rbacService.getRolesByUserIds).toHaveBeenCalledWith(['u1', 'u2']);
      expect(result.data[0]?.roles).toEqual([{ id: 'r1', name: 'Admin', userType: 'admin' }]);
      expect(result.data[1]?.roles).toEqual([]);
    });

    it('list short-circuits on empty page (no reader call)', async () => {
      const ctx = buildService();
      ctx.entityService.list.mockResolvedValue({ data: [], meta: {} });

      const result = await ctx.service.list({} as never);

      expect(result.data).toEqual([]);
      expect(ctx.rbacService.getRolesByUserIds).not.toHaveBeenCalled();
    });

    it('findOne attaches roles for the single row via batch reader', async () => {
      const ctx = buildService({
        rbac: {
          getRolesByUserIds: vi.fn(async (ids: string[]) => ({
            [ids[0]!]: [{ id: 'r1', name: 'Editor', userType: 'admin' }],
          })),
        },
      });
      ctx.entityService.findOneOrFail.mockResolvedValue({ id: 'u1', email: 'x@y.com' });

      const enriched = await ctx.service.findOne('u1');

      expect(ctx.rbacService.getRolesByUserIds).toHaveBeenCalledWith(['u1']);
      expect((enriched as any).roles).toEqual([{ id: 'r1', name: 'Editor', userType: 'admin' }]);
    });

    it('findOne returns empty roles array when the user has none', async () => {
      const ctx = buildService();
      ctx.entityService.findOneOrFail.mockResolvedValue({ id: 'u1' });
      const enriched = await ctx.service.findOne('u1');
      expect((enriched as any).roles).toEqual([]);
    });

    it('list attaches positions per row via batch positionsReader', async () => {
      const positionsReader = {
        getPositionsByUserIds: vi.fn(async (ids: string[]) => ({
          [ids[0]!]: [{ unitId: 'ou1', unitName: 'Tax', positionId: 'p1', positionName: 'Head' }],
          [ids[1]!]: [],
        })),
      };
      const ctx = buildService({ positionsReader });
      ctx.entityService.list.mockResolvedValue({
        data: [{ id: 'u1' }, { id: 'u2' }],
        meta: {},
      });

      const result = await ctx.service.list({} as never);

      expect(positionsReader.getPositionsByUserIds).toHaveBeenCalledWith(['u1', 'u2']);
      expect(result.data[0]?.positions).toEqual([
        { unitId: 'ou1', unitName: 'Tax', positionId: 'p1', positionName: 'Head' },
      ]);
      expect(result.data[1]?.positions).toEqual([]);
    });

    it('list returns positions:[] on every row when no positionsReader is wired', async () => {
      const ctx = buildService();
      ctx.entityService.list.mockResolvedValue({
        data: [{ id: 'u1' }, { id: 'u2' }],
        meta: {},
      });

      const result = await ctx.service.list({} as never);

      expect(result.data[0]?.positions).toEqual([]);
      expect(result.data[1]?.positions).toEqual([]);
    });

    it('findOne attaches positions for the single row', async () => {
      const positionsReader = {
        getPositionsByUserIds: vi.fn(async (ids: string[]) => ({
          [ids[0]!]: [{ unitId: 'ou1', unitName: 'Audit', positionId: null, positionName: null }],
        })),
      };
      const ctx = buildService({ positionsReader });
      ctx.entityService.findOneOrFail.mockResolvedValue({ id: 'u1' });

      const enriched = await ctx.service.findOne('u1');

      expect(positionsReader.getPositionsByUserIds).toHaveBeenCalledWith(['u1']);
      expect((enriched as any).positions).toEqual([
        { unitId: 'ou1', unitName: 'Audit', positionId: null, positionName: null },
      ]);
    });

    it('list runs roles and positions readers in parallel and combines both', async () => {
      const positionsReader = {
        getPositionsByUserIds: vi.fn(async (ids: string[]) => ({
          [ids[0]!]: [{ unitId: 'ou1', unitName: 'Tax', positionId: 'p1', positionName: 'Head' }],
        })),
      };
      const ctx = buildService({
        rbac: {
          getRolesByUserIds: vi.fn(async (ids: string[]) => ({
            [ids[0]!]: [{ id: 'r1', name: 'Admin', userType: 'admin' }],
          })),
        },
        positionsReader,
      });
      ctx.entityService.list.mockResolvedValue({
        data: [{ id: 'u1', deletedAt: null, invitedAt: null, acceptedAt: null }],
        meta: {},
      });

      const result = await ctx.service.list({} as never);

      expect(result.data[0]?.roles).toEqual([{ id: 'r1', name: 'Admin', userType: 'admin' }]);
      expect(result.data[0]?.positions).toEqual([
        { unitId: 'ou1', unitName: 'Tax', positionId: 'p1', positionName: 'Head' },
      ]);
      expect(result.data[0]?.status).toBe('active');
    });
  });
});
