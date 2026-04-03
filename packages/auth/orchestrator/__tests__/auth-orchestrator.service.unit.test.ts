import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnauthorizedException, BadRequestException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { AuthOrchestratorService } from '../auth-orchestrator.service';

function createMockAuthService() {
  return {
    verifyPasswordCredential: vi.fn(),
    generateAccessToken: vi.fn().mockReturnValue('access-token'),
    createRefreshToken: vi.fn().mockResolvedValue({ token: 'refresh-token', expiresAt: new Date() }),
    refresh: vi.fn().mockResolvedValue({ userId: 'u1', token: 'new-refresh-token', expiresAt: new Date() }),
    logout: vi.fn().mockResolvedValue(undefined),
    logoutAll: vi.fn().mockResolvedValue(undefined),
    changePassword: vi.fn().mockResolvedValue(undefined),
    createPasswordResetToken: vi.fn().mockResolvedValue({ token: 'reset-token', expiresAt: new Date() }),
    resetPassword: vi.fn().mockResolvedValue(undefined),
    createPasswordCredential: vi.fn().mockResolvedValue({ id: 'cred-1' }),
    findCredential: vi.fn().mockResolvedValue(null),
    createCredential: vi.fn().mockResolvedValue({ id: 'cred-2' }),
    findUserByEmail: vi.fn().mockResolvedValue(null),
  } as any;
}

function createMockRbacService() {
  return {
    getPermissionsForUser: vi.fn().mockResolvedValue({ '*': 'all' }),
    findDefaultRoleForUserType: vi.fn().mockResolvedValue({ id: 'role-1', name: 'Client' }),
    assignRoleToUser: vi.fn().mockResolvedValue(undefined),
  } as any;
}

function createMockDatabaseService() {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  };

  const insertChain = {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: 'new-user-1' }]),
    }),
  };

  return {
    db: {
      select: vi.fn().mockReturnValue(selectChain),
      insert: vi.fn().mockReturnValue(insertChain),
      transaction: vi.fn().mockImplementation(async (cb: any) => {
        const txSelectChain = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
        };
        const txInsertChain = {
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 'new-user-1' }]),
          }),
        };
        const tx = {
          select: vi.fn().mockReturnValue(txSelectChain),
          insert: vi.fn().mockReturnValue(txInsertChain),
        };
        return cb(tx);
      }),
    },
    _selectChain: selectChain,
  };
}

function createMockEventEmitter() {
  return {
    emit: vi.fn(),
  } as any;
}

function createMockAdapterRegistry() {
  const passwordAdapter = {
    provider: 'password',
    authenticate: vi.fn(),
  };
  return {
    get: vi.fn().mockImplementation((provider: string) => {
      if (provider === 'password') return passwordAdapter;
      return undefined;
    }),
    has: vi.fn().mockImplementation((provider: string) => provider === 'password'),
    register: vi.fn(),
    getAll: vi.fn().mockReturnValue([passwordAdapter]),
    _passwordAdapter: passwordAdapter,
  } as any;
}

function createMockLogger() {
  return {
    forContext: vi.fn().mockReturnValue({
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    }),
  } as any;
}

describe('AuthOrchestratorService', () => {
  let service: AuthOrchestratorService;
  let authService: ReturnType<typeof createMockAuthService>;
  let rbacService: ReturnType<typeof createMockRbacService>;
  let database: ReturnType<typeof createMockDatabaseService>;
  let eventEmitter: ReturnType<typeof createMockEventEmitter>;
  let adapterRegistry: ReturnType<typeof createMockAdapterRegistry>;

  beforeEach(() => {
    authService = createMockAuthService();
    rbacService = createMockRbacService();
    database = createMockDatabaseService();
    eventEmitter = createMockEventEmitter();
    adapterRegistry = createMockAdapterRegistry();
    const logger = createMockLogger();

    // Configure password adapter to delegate to authService
    adapterRegistry._passwordAdapter.authenticate.mockImplementation(async (creds: any) => {
      const { userId } = await authService.verifyPasswordCredential(creds.identifier, creds.password);
      return {
        userId,
        email: creds.identifier,
        provider: 'password',
        providerIdentifier: creds.identifier,
        isNewUser: false,
        isNewCredential: false,
      };
    });

    service = new AuthOrchestratorService(
      authService,
      rbacService,
      database as any,
      eventEmitter,
      adapterRegistry,
      logger,
    );
  });

  describe('login', () => {
    it('should return tokens on valid credentials', async () => {
      authService.verifyPasswordCredential.mockResolvedValue({ userId: 'u1' });
      database._selectChain.limit.mockResolvedValue([{
        email: 'john@test.com',
        firstName: 'John',
        lastName: 'Doe',
        userType: 'client',
      }]);

      const result = await service.login('john@test.com', 'password', 'client');

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        userId: 'u1',
      });
      expect(authService.verifyPasswordCredential).toHaveBeenCalledWith('john@test.com', 'password');
      expect(rbacService.getPermissionsForUser).toHaveBeenCalledWith('u1', 'client');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'auth.UserLoggedIn',
        expect.objectContaining({ entityType: 'users', entityId: 'u1' }),
      );
    });

    it('should throw when user type does not match', async () => {
      authService.verifyPasswordCredential.mockResolvedValue({ userId: 'u1' });
      database._selectChain.limit.mockResolvedValue([{
        email: 'john@test.com',
        firstName: 'John',
        lastName: 'Doe',
        userType: 'admin',
      }]);

      await expect(service.login('john@test.com', 'password', 'client'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should throw when user not found', async () => {
      authService.verifyPasswordCredential.mockResolvedValue({ userId: 'u1' });
      database._selectChain.limit.mockResolvedValue([]);

      await expect(service.login('john@test.com', 'password', 'client'))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('should return new tokens', async () => {
      const result = await service.refresh('old-token', 'client');

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(authService.refresh).toHaveBeenCalledWith('old-token');
      expect(rbacService.getPermissionsForUser).toHaveBeenCalledWith('u1', 'client');
    });
  });

  describe('logout', () => {
    it('should delegate to auth service', async () => {
      await service.logout('refresh-token');
      expect(authService.logout).toHaveBeenCalledWith('refresh-token');
    });
  });

  describe('logoutAll', () => {
    it('should delegate to auth service', async () => {
      await service.logoutAll('u1');
      expect(authService.logoutAll).toHaveBeenCalledWith('u1');
    });
  });

  describe('register', () => {
    it('should create user, credential, assign role, and return tokens', async () => {
      const data = { email: 'new@test.com', firstName: 'New', lastName: 'User', password: 'Pass1234' };

      const result = await service.register(data, 'client');

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        userId: 'new-user-1',
      });
      expect(rbacService.findDefaultRoleForUserType).toHaveBeenCalledWith('client');
      expect(rbacService.assignRoleToUser).toHaveBeenCalledWith('new-user-1', 'role-1');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'auth.UserRegistered',
        expect.objectContaining({ entityType: 'users', entityId: 'new-user-1' }),
      );
    });

    it('should throw ConflictException when email already exists', async () => {
      database._selectChain.limit.mockResolvedValue([{ id: 'existing-user' }]);

      await expect(service.register(
        { email: 'existing@test.com', firstName: 'E', lastName: 'U', password: 'Pass1234' },
        'client',
      )).rejects.toThrow(ConflictException);
    });

    it('should throw InternalServerErrorException when no default role', async () => {
      rbacService.findDefaultRoleForUserType.mockResolvedValue(null);

      await expect(service.register(
        { email: 'new@test.com', firstName: 'N', lastName: 'U', password: 'Pass1234' },
        'client',
      )).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('changePassword', () => {
    it('should delegate to auth service and emit event', async () => {
      database._selectChain.limit.mockResolvedValue([{
        email: 'john@test.com', firstName: 'John', lastName: 'Doe', userType: 'client',
      }]);

      await service.changePassword('u1', 'old', 'new');

      expect(authService.changePassword).toHaveBeenCalledWith('u1', 'old', 'new');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'auth.PasswordChanged',
        expect.objectContaining({ entityType: 'users', entityId: 'u1' }),
      );
    });
  });

  describe('forgotPassword', () => {
    it('should create reset token and emit event when token exists', async () => {
      await service.forgotPassword('john@test.com');

      expect(authService.createPasswordResetToken).toHaveBeenCalledWith('john@test.com');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'auth.PasswordResetRequested',
        expect.objectContaining({ entityType: 'users' }),
      );
    });

    it('should not emit event when token is empty (user not found)', async () => {
      authService.createPasswordResetToken.mockResolvedValue({ token: '', expiresAt: new Date() });

      await service.forgotPassword('unknown@test.com');

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should delegate to auth service and emit event', async () => {
      await service.resetPassword('valid-token', 'new-password');

      expect(authService.resetPassword).toHaveBeenCalledWith('valid-token', 'new-password');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'auth.PasswordResetCompleted',
        expect.objectContaining({ entityType: 'users' }),
      );
    });
  });

  describe('loginWithProvider', () => {
    it('should throw BadRequestException for unknown provider', async () => {
      await expect(service.loginWithProvider('unknown', {}, 'client'))
        .rejects.toThrow(BadRequestException);
    });

    it('should handle existing user login via adapter', async () => {
      const mockAdapter = {
        provider: 'google',
        authenticate: vi.fn().mockResolvedValue({
          userId: 'u1',
          email: 'john@test.com',
          provider: 'google',
          providerIdentifier: 'google-123',
          isNewUser: false,
          isNewCredential: false,
        }),
      };
      adapterRegistry.get.mockImplementation((p: string) =>
        p === 'google' ? mockAdapter : undefined,
      );

      database._selectChain.limit.mockResolvedValue([{
        email: 'john@test.com',
        firstName: 'John',
        lastName: 'Doe',
        userType: 'client',
      }]);

      const result = await service.loginWithProvider('google', { code: 'abc', redirectUri: 'http://localhost' }, 'client');

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        userId: 'u1',
      });
      expect(mockAdapter.authenticate).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'auth.UserLoggedIn',
        expect.objectContaining({ entityId: 'u1' }),
      );
    });

    it('should create credential for account linking', async () => {
      const mockAdapter = {
        provider: 'google',
        authenticate: vi.fn().mockResolvedValue({
          userId: 'u1',
          email: 'john@test.com',
          provider: 'google',
          providerIdentifier: 'google-123',
          isNewUser: false,
          isNewCredential: true,
        }),
      };
      adapterRegistry.get.mockImplementation((p: string) =>
        p === 'google' ? mockAdapter : undefined,
      );

      database._selectChain.limit.mockResolvedValue([{
        email: 'john@test.com',
        firstName: 'John',
        lastName: 'Doe',
        userType: 'client',
      }]);

      await service.loginWithProvider('google', { code: 'abc', redirectUri: 'http://localhost' }, 'client');

      expect(authService.createCredential).toHaveBeenCalledWith('u1', 'google', 'google-123');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'auth.AccountLinked',
        expect.objectContaining({
          entityId: 'u1',
          payload: expect.objectContaining({ provider: 'google' }),
        }),
      );
    });

    it('should create user and credential for new OAuth user', async () => {
      const mockAdapter = {
        provider: 'google',
        authenticate: vi.fn().mockResolvedValue({
          email: 'new@test.com',
          firstName: 'New',
          lastName: 'User',
          provider: 'google',
          providerIdentifier: 'google-456',
          isNewUser: true,
          isNewCredential: true,
        }),
      };
      adapterRegistry.get.mockImplementation((p: string) =>
        p === 'google' ? mockAdapter : undefined,
      );

      // After transaction, loadUser returns the new user
      database._selectChain.limit.mockResolvedValue([{
        email: 'new@test.com',
        firstName: 'New',
        lastName: 'User',
        userType: 'client',
      }]);

      const result = await service.loginWithProvider('google', { code: 'abc', redirectUri: 'http://localhost' }, 'client');

      expect(result.userId).toBe('new-user-1');
      expect(rbacService.findDefaultRoleForUserType).toHaveBeenCalledWith('client');
      expect(rbacService.assignRoleToUser).toHaveBeenCalledWith('new-user-1', 'role-1');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'auth.UserRegistered',
        expect.objectContaining({
          entityId: 'new-user-1',
          payload: expect.objectContaining({ authProvider: 'google' }),
        }),
      );
    });

    it('should throw when new OAuth user type does not match', async () => {
      const mockAdapter = {
        provider: 'google',
        authenticate: vi.fn().mockResolvedValue({
          email: 'new@test.com',
          provider: 'google',
          providerIdentifier: 'google-456',
          isNewUser: true,
          isNewCredential: true,
        }),
      };
      adapterRegistry.get.mockImplementation((p: string) =>
        p === 'google' ? mockAdapter : undefined,
      );

      // loadUser returns null (user not found after creation — edge case)
      database._selectChain.limit.mockResolvedValue([]);

      await expect(service.loginWithProvider('google', { code: 'abc', redirectUri: 'http://localhost' }, 'client'))
        .rejects.toThrow(UnauthorizedException);
    });
  });
});
