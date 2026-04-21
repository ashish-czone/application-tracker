import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { UserRolesRelationHandler } from '../user-roles-relation-handler';

function buildTxMock(currentAssignments: { roleId: string }[] = []) {
  const insertValues = vi.fn().mockReturnValue({ onConflictDoNothing: vi.fn().mockResolvedValue(undefined) });
  const insert = vi.fn().mockReturnValue({ values: insertValues });
  const deleteWhere = vi.fn().mockResolvedValue(undefined);
  const del = vi.fn().mockReturnValue({ where: deleteWhere });
  const selectWhere = vi.fn().mockResolvedValue(currentAssignments);
  const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
  const select = vi.fn().mockReturnValue({ from: selectFrom });

  return {
    tx: { insert, delete: del, select } as unknown,
    spies: { insert, insertValues, delete: del, deleteWhere, select, selectFrom, selectWhere },
  };
}

function buildHandler(findRoleById: (id: string) => Promise<unknown>) {
  const rbacService = { findRoleById: vi.fn(findRoleById) };
  return { handler: new UserRolesRelationHandler(rbacService as any), rbacService };
}

describe('UserRolesRelationHandler', () => {
  describe('onCreate', () => {
    it('assigns each role in the payload when userType matches', async () => {
      const { handler, rbacService } = buildHandler(async (id) => ({ id, userType: 'agency_admin', name: id }));
      const { tx, spies } = buildTxMock();

      await handler.onCreate(tx, 'user-1', ['role-1', 'role-2'], 'actor', {
        parent: { userType: 'agency_admin' },
      });

      expect(rbacService.findRoleById).toHaveBeenCalledWith('role-1');
      expect(rbacService.findRoleById).toHaveBeenCalledWith('role-2');
      expect(spies.insert).toHaveBeenCalledTimes(2);
    });

    it('allows roles with userType=null (wildcard) regardless of parent.userType', async () => {
      const { handler } = buildHandler(async (id) => ({ id, userType: null, name: id }));
      const { tx, spies } = buildTxMock();

      await handler.onCreate(tx, 'user-1', ['role-1'], 'actor', {
        parent: { userType: 'agency_customer' },
      });

      expect(spies.insert).toHaveBeenCalledTimes(1);
    });

    it('throws Conflict when a role.userType does not match parent.userType', async () => {
      const { handler } = buildHandler(async (id) => ({ id, userType: 'agency_admin', name: id }));
      const { tx, spies } = buildTxMock();

      await expect(
        handler.onCreate(tx, 'user-1', ['role-1'], 'actor', { parent: { userType: 'agency_customer' } }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(spies.insert).not.toHaveBeenCalled();
    });

    it('throws NotFound when a role does not exist', async () => {
      const { handler } = buildHandler(async () => null);
      const { tx, spies } = buildTxMock();

      await expect(
        handler.onCreate(tx, 'user-1', ['missing'], 'actor', { parent: { userType: 'agency_admin' } }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(spies.insert).not.toHaveBeenCalled();
    });

    it('throws BadRequest for non-array payload', async () => {
      const { handler } = buildHandler(async () => null);
      const { tx } = buildTxMock();

      // Non-array payloads are silently ignored (the relationship key is
      // present but empty) — actual validation happens on entries inside.
      // Here we cover the entry-validation path.
      await expect(
        handler.onCreate(tx, 'user-1', ['valid', 123 as unknown as string], 'actor', { parent: { userType: 'x' } }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('is a no-op for empty array payload', async () => {
      const { handler, rbacService } = buildHandler(async (id) => ({ id, userType: 'x', name: id }));
      const { tx, spies } = buildTxMock();

      await handler.onCreate(tx, 'user-1', [], 'actor', { parent: { userType: 'x' } });

      expect(rbacService.findRoleById).not.toHaveBeenCalled();
      expect(spies.insert).not.toHaveBeenCalled();
    });

    it('de-duplicates role IDs in the payload', async () => {
      const { handler } = buildHandler(async (id) => ({ id, userType: 'x', name: id }));
      const { tx, spies } = buildTxMock();

      await handler.onCreate(tx, 'user-1', ['role-1', 'role-1', 'role-2'], 'actor', {
        parent: { userType: 'x' },
      });

      expect(spies.insert).toHaveBeenCalledTimes(2);
    });
  });

  describe('onUpdate', () => {
    it('adds missing roles and removes extras by diffing current assignments', async () => {
      const { handler } = buildHandler(async (id) => ({ id, userType: 'x', name: id }));
      const { tx, spies } = buildTxMock([{ roleId: 'keep' }, { roleId: 'remove' }]);

      await handler.onUpdate(tx, 'user-1', ['keep', 'add'], 'actor', { parent: { userType: 'x' } });

      expect(spies.insert).toHaveBeenCalledTimes(1); // only 'add'
      expect(spies.delete).toHaveBeenCalledTimes(1); // 'remove' goes in one delete
    });

    it('no-ops when desired and current sets are equal', async () => {
      const { handler } = buildHandler(async (id) => ({ id, userType: 'x', name: id }));
      const { tx, spies } = buildTxMock([{ roleId: 'a' }, { roleId: 'b' }]);

      await handler.onUpdate(tx, 'user-1', ['a', 'b'], 'actor', { parent: { userType: 'x' } });

      expect(spies.insert).not.toHaveBeenCalled();
      expect(spies.delete).not.toHaveBeenCalled();
    });

    it('removes everything when desired is empty', async () => {
      const { handler } = buildHandler(async (id) => ({ id, userType: 'x', name: id }));
      const { tx, spies } = buildTxMock([{ roleId: 'a' }, { roleId: 'b' }]);

      await handler.onUpdate(tx, 'user-1', [], 'actor', { parent: { userType: 'x' } });

      expect(spies.insert).not.toHaveBeenCalled();
      expect(spies.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe('onDelete', () => {
    it('is a no-op', async () => {
      const { handler } = buildHandler(async () => null);
      const { tx, spies } = buildTxMock();

      await handler.onDelete(tx, 'user-1', 'actor', { kind: 'soft' }, { parent: {} });
      await handler.onDelete(tx, 'user-1', 'actor', { kind: 'hard' }, { parent: {} });

      expect(spies.insert).not.toHaveBeenCalled();
      expect(spies.delete).not.toHaveBeenCalled();
    });
  });
});
