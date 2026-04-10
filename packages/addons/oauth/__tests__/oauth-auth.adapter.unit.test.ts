import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OAuthAuthAdapter } from '../oauth-auth.adapter';

function createMockProviderRegistry() {
  const googleProvider = {
    provider: 'google',
    defaultScopes: ['openid', 'email', 'profile'],
    getAuthorizationUrl: vi.fn(),
    exchangeCode: vi.fn().mockResolvedValue({ accessToken: 'google-access-token' }),
    getUserProfile: vi.fn().mockResolvedValue({
      providerUserId: 'google-123',
      email: 'john@gmail.com',
      firstName: 'John',
      lastName: 'Doe',
      avatarUrl: 'https://lh3.googleusercontent.com/photo',
    }),
  };

  return {
    get: vi.fn().mockImplementation((name: string) => name === 'google' ? googleProvider : undefined),
    has: vi.fn().mockImplementation((name: string) => name === 'google'),
    _google: googleProvider,
  };
}

function createMockAuthService() {
  return {
    findCredential: vi.fn().mockResolvedValue(null),
    findUserByEmail: vi.fn().mockResolvedValue(null),
  };
}

function createMockAppConfig(clientId = 'client-id', clientSecret = 'client-secret') {
  return {
    get: vi.fn().mockImplementation((_module: string, key: string, defaultValue?: string) => {
      if (key === 'google.clientId') return clientId;
      if (key === 'google.clientSecret') return clientSecret;
      return defaultValue ?? '';
    }),
  };
}

describe('OAuthAuthAdapter', () => {
  let adapter: OAuthAuthAdapter;
  let providerRegistry: ReturnType<typeof createMockProviderRegistry>;
  let authService: ReturnType<typeof createMockAuthService>;

  beforeEach(() => {
    vi.clearAllMocks();
    providerRegistry = createMockProviderRegistry();
    authService = createMockAuthService();
    const appConfig = createMockAppConfig();

    adapter = new OAuthAuthAdapter(
      providerRegistry as any,
      authService as any,
      appConfig as any,
    );
  });

  it('throws for unregistered provider', async () => {
    await expect(
      adapter.authenticateForProvider('github', { code: 'abc', redirectUri: 'http://localhost' }),
    ).rejects.toThrow('OAuth provider not registered: github');
  });

  it('throws when provider has no credentials configured', async () => {
    const appConfig = createMockAppConfig('', '');
    const adapterNoConfig = new OAuthAuthAdapter(
      providerRegistry as any,
      authService as any,
      appConfig as any,
    );

    await expect(
      adapterNoConfig.authenticateForProvider('google', { code: 'abc', redirectUri: 'http://localhost' }),
    ).rejects.toThrow('OAuth provider not configured: google');
  });

  it('returns existing user when credential found', async () => {
    authService.findCredential.mockResolvedValue({ userId: 'u1', provider: 'google', identifier: 'google-123' });

    const result = await adapter.authenticateForProvider('google', {
      code: 'auth-code',
      redirectUri: 'http://localhost/oauth/callback',
    });

    expect(providerRegistry._google.exchangeCode).toHaveBeenCalledWith(
      'auth-code', 'http://localhost/oauth/callback', 'client-id', 'client-secret',
    );
    expect(providerRegistry._google.getUserProfile).toHaveBeenCalledWith('google-access-token');
    expect(result).toEqual({
      userId: 'u1',
      email: 'john@gmail.com',
      provider: 'google',
      providerIdentifier: 'google-123',
      isNewUser: false,
      isNewCredential: false,
    });
  });

  it('returns account linking result when user exists by email', async () => {
    authService.findCredential.mockResolvedValue(null);
    authService.findUserByEmail.mockResolvedValue({ id: 'u2', email: 'john@gmail.com' });

    const result = await adapter.authenticateForProvider('google', {
      code: 'auth-code',
      redirectUri: 'http://localhost/oauth/callback',
    });

    expect(result).toEqual({
      userId: 'u2',
      email: 'john@gmail.com',
      provider: 'google',
      providerIdentifier: 'google-123',
      isNewUser: false,
      isNewCredential: true,
    });
  });

  it('returns new user result when no credential or user found', async () => {
    authService.findCredential.mockResolvedValue(null);
    authService.findUserByEmail.mockResolvedValue(null);

    const result = await adapter.authenticateForProvider('google', {
      code: 'auth-code',
      redirectUri: 'http://localhost/oauth/callback',
    });

    expect(result).toEqual({
      email: 'john@gmail.com',
      firstName: 'John',
      lastName: 'Doe',
      provider: 'google',
      providerIdentifier: 'google-123',
      isNewUser: true,
      isNewCredential: true,
    });
  });
});
