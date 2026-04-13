import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminAuthService } from '../admin-auth.service';

describe('AdminAuthService', () => {
  let service: AdminAuthService;

  const mockTokens = { accessToken: 'access-token', refreshToken: 'refresh-token', userId: 'a1' };
  const mockRefreshResult = { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' };

  beforeEach(() => {
    // Create instance without calling constructor (avoids injecting all NestJS deps)
    service = Object.create(AdminAuthService.prototype);

    // Stub the inherited parent methods
    service.login = vi.fn().mockResolvedValue(mockTokens);
    service.refresh = vi.fn().mockResolvedValue(mockRefreshResult);
    service.loginWithProvider = vi.fn().mockResolvedValue(mockTokens);
  });

  describe('adminLogin', () => {
    it('should delegate to login with userType "admin"', async () => {
      const result = await service.adminLogin('admin@test.com', 'admin-pass');

      expect(service.login).toHaveBeenCalledWith('admin@test.com', 'admin-pass', 'admin');
      expect(result).toEqual(mockTokens);
    });
  });

  describe('adminRefresh', () => {
    it('should delegate to refresh with userType "admin"', async () => {
      const result = await service.adminRefresh('old-refresh-token');

      expect(service.refresh).toHaveBeenCalledWith('old-refresh-token', 'admin');
      expect(result).toEqual(mockRefreshResult);
    });
  });

  describe('adminOAuthLogin', () => {
    it('should delegate to loginWithProvider with userType "admin"', async () => {
      const result = await service.adminOAuthLogin('google', 'auth-code-456', 'http://localhost/admin/callback');

      expect(service.loginWithProvider).toHaveBeenCalledWith(
        'google',
        { provider: 'google', code: 'auth-code-456', redirectUri: 'http://localhost/admin/callback' },
        'admin',
      );
      expect(result).toEqual(mockTokens);
    });

    it('should pass correct credentials object for different providers', async () => {
      await service.adminOAuthLogin('azure-ad', 'az-code', 'http://localhost/admin/az-callback');

      expect(service.loginWithProvider).toHaveBeenCalledWith(
        'azure-ad',
        { provider: 'azure-ad', code: 'az-code', redirectUri: 'http://localhost/admin/az-callback' },
        'admin',
      );
    });

    it('should return the token result from loginWithProvider', async () => {
      const customResult = { accessToken: 'custom-at', refreshToken: 'custom-rt', userId: 'a2' };
      (service.loginWithProvider as ReturnType<typeof vi.fn>).mockResolvedValueOnce(customResult);

      const result = await service.adminOAuthLogin('google', 'code', 'http://localhost');

      expect(result).toEqual(customResult);
    });
  });
});
