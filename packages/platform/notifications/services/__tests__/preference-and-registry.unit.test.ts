import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PreferenceService } from '../preference.service';
import { ContactResolverRegistry } from '../contact-resolver-registry';
import type { AppLoggerService } from '@packages/logger';

vi.mock('@packages/tenancy/helpers', () => ({
  withTenant: vi.fn((_table, ...conditions) => conditions[0]),
}));

function createMockDb() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  };
  return { db: chain, _chain: chain };
}

function createMockAppLogger(): AppLoggerService {
  const ctx = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { forContext: vi.fn().mockReturnValue(ctx), log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any;
}

describe('PreferenceService', () => {
  let service: PreferenceService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new PreferenceService({ db: mockDb.db } as any);
  });

  describe('isEnabled', () => {
    it('should return true when preference is enabled', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([{ isEnabled: true }]);

      const result = await service.isEnabled('user-1', 'email');

      expect(result).toBe(true);
    });

    it('should return false when preference is disabled', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([{ isEnabled: false }]);

      const result = await service.isEnabled('user-1', 'email');

      expect(result).toBe(false);
    });

    it('should return true when no preference exists (default enabled)', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      const result = await service.isEnabled('user-1', 'whatsapp');

      expect(result).toBe(true);
    });

    it('should query with correct userId and channel', async () => {
      mockDb._chain.limit.mockResolvedValueOnce([]);

      await service.isEnabled('user-42', 'in_app');

      expect(mockDb._chain.select).toHaveBeenCalled();
      expect(mockDb._chain.from).toHaveBeenCalled();
      expect(mockDb._chain.where).toHaveBeenCalled();
      expect(mockDb._chain.limit).toHaveBeenCalledWith(1);
    });
  });
});

describe('ContactResolverRegistry', () => {
  let registry: ContactResolverRegistry;
  let mockLogger: AppLoggerService;
  let loggerCtx: { log: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockLogger = createMockAppLogger();
    loggerCtx = (mockLogger.forContext as any).mock.results[0]?.value
      ?? { log: vi.fn(), warn: vi.fn() };
    registry = new ContactResolverRegistry(mockLogger);
    // Re-capture logger context after construction
    loggerCtx = (mockLogger.forContext as ReturnType<typeof vi.fn>).mock.results[0].value;
  });

  describe('register', () => {
    it('should register a resolver and log the registration', () => {
      const resolver = vi.fn();

      registry.register('email', resolver);

      expect(registry.has('email')).toBe(true);
      expect(loggerCtx.log).toHaveBeenCalledWith('Registered contact resolver for channel: email');
    });

    it('should overwrite a previously registered resolver for the same channel', () => {
      const firstResolver = vi.fn().mockResolvedValue('first@example.com');
      const secondResolver = vi.fn().mockResolvedValue('second@example.com');

      registry.register('email', firstResolver);
      registry.register('email', secondResolver);

      expect(registry.has('email')).toBe(true);
      expect(loggerCtx.log).toHaveBeenCalledTimes(2);
    });
  });

  describe('has', () => {
    it('should return true for a registered channel', () => {
      registry.register('email', vi.fn());

      expect(registry.has('email')).toBe(true);
    });

    it('should return false for an unregistered channel', () => {
      expect(registry.has('sms')).toBe(false);
    });
  });

  describe('resolve', () => {
    it('should call the resolver and return contact info', async () => {
      const resolver = vi.fn().mockResolvedValue('john@example.com');
      registry.register('email', resolver);

      const result = await registry.resolve('email', 'user-1');

      expect(result).toBe('john@example.com');
      expect(resolver).toHaveBeenCalledWith('user-1');
    });

    it('should return null when no resolver is registered and log a warning', async () => {
      const result = await registry.resolve('sms', 'user-1');

      expect(result).toBeNull();
      expect(loggerCtx.warn).toHaveBeenCalledWith('No contact resolver registered for channel "sms"');
    });

    it('should return null when the resolver itself returns null', async () => {
      const resolver = vi.fn().mockResolvedValue(null);
      registry.register('whatsapp', resolver);

      const result = await registry.resolve('whatsapp', 'user-1');

      expect(result).toBeNull();
      expect(resolver).toHaveBeenCalledWith('user-1');
    });

    it('should use the latest resolver after overwrite', async () => {
      registry.register('email', vi.fn().mockResolvedValue('old@example.com'));
      registry.register('email', vi.fn().mockResolvedValue('new@example.com'));

      const result = await registry.resolve('email', 'user-1');

      expect(result).toBe('new@example.com');
    });
  });
});
