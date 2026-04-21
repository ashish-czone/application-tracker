import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from '../users.service';

vi.mock('@packages/tenancy/helpers', () => ({
  withTenant: vi.fn((_table: any, ...conditions: any[]) => conditions[0] ?? true),
}));

function createMockDb() {
  const mockChain: any = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  };
  return {
    select: vi.fn().mockReturnValue(mockChain),
    _chain: mockChain,
  };
}

function createMockAuthService() {
  return {
    changePasswordDirect: vi.fn().mockResolvedValue(undefined),
  };
}

function buildService() {
  const mockDb = createMockDb();
  const authService = createMockAuthService();
  const service = new UsersService(
    { db: mockDb } as any,
    authService as any,
  );
  return { service, mockDb, authService };
}

describe('UsersService (thin)', () => {
  let ctx: ReturnType<typeof buildService>;

  beforeEach(() => {
    ctx = buildService();
  });

  describe('getEmail', () => {
    it('returns the email for an active user', async () => {
      ctx.mockDb._chain.limit.mockResolvedValueOnce([{ email: 'alice@example.com' }]);
      const result = await ctx.service.getEmail('user-1');
      expect(result).toBe('alice@example.com');
    });

    it('returns null when the user is not found', async () => {
      ctx.mockDb._chain.limit.mockResolvedValueOnce([]);
      const result = await ctx.service.getEmail('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getPhone', () => {
    it('returns the phone for an active user', async () => {
      ctx.mockDb._chain.limit.mockResolvedValueOnce([{ phone: '+15551234567' }]);
      const result = await ctx.service.getPhone('user-1');
      expect(result).toBe('+15551234567');
    });

    it('returns null when the user has no phone', async () => {
      ctx.mockDb._chain.limit.mockResolvedValueOnce([{ phone: null }]);
      const result = await ctx.service.getPhone('user-1');
      expect(result).toBeNull();
    });

    it('returns null when the user is not found', async () => {
      ctx.mockDb._chain.limit.mockResolvedValueOnce([]);
      const result = await ctx.service.getPhone('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('resetPassword', () => {
    it('delegates to AuthService.changePasswordDirect for an existing user', async () => {
      ctx.mockDb._chain.limit.mockResolvedValueOnce([{ id: 'user-1' }]);

      await ctx.service.resetPassword('user-1', 'NewPass!234');

      expect(ctx.authService.changePasswordDirect).toHaveBeenCalledWith('user-1', 'NewPass!234');
    });

    it('throws NotFoundException when the user is not found', async () => {
      ctx.mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(ctx.service.resetPassword('ghost', 'NewPass!234'))
        .rejects.toThrow(NotFoundException);
      expect(ctx.authService.changePasswordDirect).not.toHaveBeenCalled();
    });

    it('does not call authService when the user is soft-deleted (filtered out)', async () => {
      // soft-deleted rows never match the active filter in the query, so the select returns []
      ctx.mockDb._chain.limit.mockResolvedValueOnce([]);

      await expect(ctx.service.resetPassword('deleted-user', 'NewPass!234'))
        .rejects.toThrow(NotFoundException);
      expect(ctx.authService.changePasswordDirect).not.toHaveBeenCalled();
    });
  });
});
