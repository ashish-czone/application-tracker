import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionExpiryProcessor } from '../subscription-expiry.processor';
import type { AppLoggerService } from '@packages/logger';
import type { SubscriptionRecord } from '../../types';

vi.mock('@packages/tenancy/helpers', () => ({
  withTenant: vi.fn((_table: any, ...conditions: any[]) => conditions[0]),
}));

function createMockAppLogger(): AppLoggerService {
  const ctx = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { forContext: vi.fn().mockReturnValue(ctx), log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any;
}

function createExpiredSubscription(id: string): Partial<SubscriptionRecord> {
  return {
    id,
    clientId: 'client-1',
    status: 'active',
    currentPeriodEnd: new Date('2026-01-01'),
  };
}

describe('SubscriptionExpiryProcessor', () => {
  let processor: SubscriptionExpiryProcessor;
  let mockDatabase: any;
  let mockLifecycleService: any;

  beforeEach(() => {
    mockDatabase = {
      db: {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      },
    };

    mockLifecycleService = {
      expireSubscription: vi.fn().mockResolvedValue(undefined),
    };

    processor = new SubscriptionExpiryProcessor(
      mockDatabase,
      mockLifecycleService,
      createMockAppLogger(),
    );
  });

  it('should find and expire active subscriptions past their period end', async () => {
    const expired = [
      createExpiredSubscription('sub-1'),
      createExpiredSubscription('sub-2'),
    ];

    mockDatabase.db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(expired),
      }),
    });

    await processor.processExpiredSubscriptions();

    expect(mockLifecycleService.expireSubscription).toHaveBeenCalledTimes(2);
    expect(mockLifecycleService.expireSubscription).toHaveBeenCalledWith('sub-1', 'system');
    expect(mockLifecycleService.expireSubscription).toHaveBeenCalledWith('sub-2', 'system');
  });

  it('should handle empty result set gracefully', async () => {
    await processor.processExpiredSubscriptions();

    expect(mockLifecycleService.expireSubscription).not.toHaveBeenCalled();
  });

  it('should continue processing remaining subscriptions when one fails', async () => {
    const expired = [
      createExpiredSubscription('sub-1'),
      createExpiredSubscription('sub-2'),
      createExpiredSubscription('sub-3'),
    ];

    mockDatabase.db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(expired),
      }),
    });

    mockLifecycleService.expireSubscription
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('DB connection lost'))
      .mockResolvedValueOnce(undefined);

    await processor.processExpiredSubscriptions();

    expect(mockLifecycleService.expireSubscription).toHaveBeenCalledTimes(3);
    expect(mockLifecycleService.expireSubscription).toHaveBeenCalledWith('sub-3', 'system');
  });

  it('should use system as actorId for expiry', async () => {
    const expired = [createExpiredSubscription('sub-1')];

    mockDatabase.db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(expired),
      }),
    });

    await processor.processExpiredSubscriptions();

    expect(mockLifecycleService.expireSubscription).toHaveBeenCalledWith('sub-1', 'system');
  });
});
