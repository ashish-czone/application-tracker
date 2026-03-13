import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacGuard } from '../rbac.guard';
import { RBAC_CONFIGS_MAP } from '../../constants';
import type { RbacService } from '../../services/rbac.service';

function createMockContext(overrides: {
  user?: Record<string, unknown> | null;
  authEntityName?: string;
} = {}) {
  const request: Record<string, unknown> = {};
  if (overrides.user !== undefined) request.user = overrides.user;
  if (overrides.authEntityName !== undefined) request.authEntityName = overrides.authEntityName;

  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as never;
}

describe('RbacGuard', () => {
  let guard: RbacGuard;
  let reflector: Reflector;
  let rbacService: RbacService;

  beforeEach(() => {
    RBAC_CONFIGS_MAP.clear();

    reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(undefined),
    } as unknown as Reflector;

    rbacService = {
      getUserPermissions: vi.fn().mockResolvedValue([]),
    } as unknown as RbacService;

    guard = new RbacGuard(reflector, rbacService);
  });

  it('should pass through when no permission metadata is set', async () => {
    const context = createMockContext({ user: { id: 'user-1' } });
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should pass through when no RBAC config exists for entity', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue('roles.manage');
    const context = createMockContext({
      user: { id: 'user-1' },
      authEntityName: 'unknown-entity',
    });
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw ForbiddenException when user has no roles', async () => {
    RBAC_CONFIGS_MAP.set('user', {} as never);
    vi.mocked(reflector.getAllAndOverride).mockReturnValue('roles.manage');
    vi.mocked(rbacService.getUserPermissions).mockResolvedValue([]);

    const context = createMockContext({
      user: { id: 'user-1' },
      authEntityName: 'user',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when user lacks required permission', async () => {
    RBAC_CONFIGS_MAP.set('user', {} as never);
    vi.mocked(reflector.getAllAndOverride).mockReturnValue('roles.manage');
    vi.mocked(rbacService.getUserPermissions).mockResolvedValue(['candidates.read']);

    const context = createMockContext({
      user: { id: 'user-1' },
      authEntityName: 'user',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should pass when user has the required permission', async () => {
    RBAC_CONFIGS_MAP.set('user', {} as never);
    vi.mocked(reflector.getAllAndOverride).mockReturnValue('roles.manage');
    vi.mocked(rbacService.getUserPermissions).mockResolvedValue(['roles.manage', 'candidates.read']);

    const context = createMockContext({
      user: { id: 'user-1' },
      authEntityName: 'user',
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw ForbiddenException when there is no user on request', async () => {
    RBAC_CONFIGS_MAP.set('user', {} as never);
    vi.mocked(reflector.getAllAndOverride).mockReturnValue('roles.manage');

    const context = createMockContext({ authEntityName: 'user' });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should look up correct entityName from request', async () => {
    RBAC_CONFIGS_MAP.set('admin', {} as never);
    vi.mocked(reflector.getAllAndOverride).mockReturnValue('admin.manage');
    vi.mocked(rbacService.getUserPermissions).mockResolvedValue(['admin.manage']);

    const context = createMockContext({
      user: { id: 'admin-1' },
      authEntityName: 'admin',
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(rbacService.getUserPermissions).toHaveBeenCalledWith('admin-1');
  });
});
