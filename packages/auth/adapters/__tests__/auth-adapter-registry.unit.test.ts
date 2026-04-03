import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthAdapterRegistry } from '../auth-adapter-registry';
import type { AuthAdapter, AuthAdapterResult } from '../auth-adapter.interface';

function createMockAdapter(provider: string): AuthAdapter {
  return {
    provider,
    authenticate: vi.fn<() => Promise<AuthAdapterResult>>().mockResolvedValue({
      userId: 'user-1',
      email: 'test@example.com',
      provider,
      providerIdentifier: 'test@example.com',
      isNewUser: false,
      isNewCredential: false,
    }),
  };
}

describe('AuthAdapterRegistry', () => {
  let registry: AuthAdapterRegistry;
  const mockLogger = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  const mockAppLogger = { forContext: vi.fn().mockReturnValue(mockLogger) };

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new AuthAdapterRegistry(mockAppLogger as any);
  });

  it('registers an adapter', () => {
    const adapter = createMockAdapter('password');
    registry.register(adapter);

    expect(registry.has('password')).toBe(true);
    expect(registry.get('password')).toBe(adapter);
    expect(mockLogger.log).toHaveBeenCalledWith('Registered auth adapter: password');
  });

  it('returns undefined for unregistered provider', () => {
    expect(registry.get('unknown')).toBeUndefined();
    expect(registry.has('unknown')).toBe(false);
  });

  it('warns when overwriting an adapter', () => {
    const adapter1 = createMockAdapter('password');
    const adapter2 = createMockAdapter('password');

    registry.register(adapter1);
    registry.register(adapter2);

    expect(mockLogger.warn).toHaveBeenCalledWith('Overwriting auth adapter for provider: password');
    expect(registry.get('password')).toBe(adapter2);
  });

  it('returns all registered adapters', () => {
    const password = createMockAdapter('password');
    const google = createMockAdapter('google');

    registry.register(password);
    registry.register(google);

    const all = registry.getAll();
    expect(all).toHaveLength(2);
    expect(all).toContain(password);
    expect(all).toContain(google);
  });

  it('returns empty array when no adapters registered', () => {
    expect(registry.getAll()).toEqual([]);
  });
});
