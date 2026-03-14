import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacGuard } from '../rbac.guard';
import { RBAC_CONFIGS_MAP } from '../../constants';
import type { RbacService } from '../../services/rbac.service';

function createMockContext(overrides: {
  identity?: Record<string, unknown> | null;
  authEntityName?: string;
} = {}) {
  const request: Record<string, unknown> = {};
  if (overrides.identity !== undefined) request.identity = overrides.identity;
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
      getIdentityPermissions: vi.fn().mockResolvedValue([]),
      getIdentityRoles: vi.fn().mockResolvedValue([]),
    } as unknown as RbacService;

    guard = new RbacGuard(reflector, rbacService);
  });

  it('should pass through when no permission metadata is set', async () => {
    const context = createMockContext({ identity: { id: 'identity-1' } });
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should pass through when no RBAC config exists for entity', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue('roles.manage');
    const context = createMockContext({
      identity: { id: 'identity-1' },
      authEntityName: 'unknown-entity',
    });
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw ForbiddenException when identity has no roles', async () => {
    RBAC_CONFIGS_MAP.set('identity', {} as never);
    vi.mocked(reflector.getAllAndOverride).mockReturnValue('roles.manage');
    vi.mocked(rbacService.getIdentityRoles).mockResolvedValue([]);
    vi.mocked(rbacService.getIdentityPermissions).mockResolvedValue([]);

    const context = createMockContext({
      identity: { id: 'identity-1' },
      authEntityName: 'identity',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when identity lacks required permission', async () => {
    RBAC_CONFIGS_MAP.set('identity', {} as never);
    vi.mocked(reflector.getAllAndOverride).mockReturnValue('roles.manage');
    vi.mocked(rbacService.getIdentityRoles).mockResolvedValue([]);
    vi.mocked(rbacService.getIdentityPermissions).mockResolvedValue(['candidates.read']);

    const context = createMockContext({
      identity: { id: 'identity-1' },
      authEntityName: 'identity',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should pass when identity has the required permission', async () => {
    RBAC_CONFIGS_MAP.set('identity', {} as never);
    vi.mocked(reflector.getAllAndOverride).mockReturnValue('roles.manage');
    vi.mocked(rbacService.getIdentityRoles).mockResolvedValue([]);
    vi.mocked(rbacService.getIdentityPermissions).mockResolvedValue(['roles.manage', 'candidates.read']);

    const context = createMockContext({
      identity: { id: 'identity-1' },
      authEntityName: 'identity',
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw ForbiddenException when there is no identity on request', async () => {
    RBAC_CONFIGS_MAP.set('identity', {} as never);
    vi.mocked(reflector.getAllAndOverride).mockReturnValue('roles.manage');

    const context = createMockContext({ authEntityName: 'identity' });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should look up correct entityName from request', async () => {
    RBAC_CONFIGS_MAP.set('admin', {} as never);
    vi.mocked(reflector.getAllAndOverride).mockReturnValue('admin.manage');
    vi.mocked(rbacService.getIdentityRoles).mockResolvedValue([]);
    vi.mocked(rbacService.getIdentityPermissions).mockResolvedValue(['admin.manage']);

    const context = createMockContext({
      identity: { id: 'admin-1' },
      authEntityName: 'admin',
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(rbacService.getIdentityPermissions).toHaveBeenCalledWith('admin-1');
  });

  it('should bypass permission check for superadmin role', async () => {
    RBAC_CONFIGS_MAP.set('identity', {} as never);
    vi.mocked(reflector.getAllAndOverride).mockReturnValue('some.permission');
    vi.mocked(rbacService.getIdentityRoles).mockResolvedValue([
      { identityId: 'identity-1', roleId: 'role-1', role: { name: 'superadmin' } },
    ] as never);

    const context = createMockContext({
      identity: { id: 'identity-1' },
      authEntityName: 'identity',
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    // Should NOT call getIdentityPermissions — bypassed
    expect(rbacService.getIdentityPermissions).not.toHaveBeenCalled();
  });
});
