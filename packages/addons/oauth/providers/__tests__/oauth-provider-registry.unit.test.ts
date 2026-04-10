import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OAuthProviderRegistry } from '../oauth-provider-registry';
import type { OAuthProvider } from '../oauth-provider.interface';

function createMockProvider(name: string): OAuthProvider {
  return {
    provider: name,
    defaultScopes: ['openid', 'email'],
    getAuthorizationUrl: vi.fn().mockReturnValue('https://example.com/auth'),
    exchangeCode: vi.fn().mockResolvedValue({ accessToken: 'token' }),
    getUserProfile: vi.fn().mockResolvedValue({
      providerUserId: '123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    }),
  };
}

describe('OAuthProviderRegistry', () => {
  let registry: OAuthProviderRegistry;
  const mockLogger = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  const mockAppLogger = { forContext: vi.fn().mockReturnValue(mockLogger) };

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new OAuthProviderRegistry(mockAppLogger as any);
  });

  it('registers a provider', () => {
    const provider = createMockProvider('google');
    registry.register(provider);

    expect(registry.has('google')).toBe(true);
    expect(registry.get('google')).toBe(provider);
    expect(mockLogger.log).toHaveBeenCalledWith('Registered OAuth provider: google');
  });

  it('returns undefined for unregistered provider', () => {
    expect(registry.get('github')).toBeUndefined();
    expect(registry.has('github')).toBe(false);
  });

  it('warns when overwriting a provider', () => {
    const p1 = createMockProvider('google');
    const p2 = createMockProvider('google');

    registry.register(p1);
    registry.register(p2);

    expect(mockLogger.warn).toHaveBeenCalledWith('Overwriting OAuth provider: google');
    expect(registry.get('google')).toBe(p2);
  });

  it('returns all registered providers', () => {
    const google = createMockProvider('google');
    const github = createMockProvider('github');

    registry.register(google);
    registry.register(github);

    const all = registry.getAll();
    expect(all).toHaveLength(2);
    expect(all).toContain(google);
    expect(all).toContain(github);
  });
});
