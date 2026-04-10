import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationQueryService } from '../notification-query.service';

vi.mock('@packages/tenancy/helpers', () => ({
  withTenant: vi.fn((_table, ...conditions) => conditions[0]),
}));

vi.mock('@packages/database', async () => {
  const actual = await vi.importActual('@packages/database');
  return {
    ...actual,
  };
});

function createMockDb() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };
  return { db: chain, _chain: chain };
}

/**
 * Setup the mock chain for listForUser which uses Promise.all with two queries:
 * 1. Data query: select().from().where().orderBy().limit().offset() -> data[]
 * 2. Count query: select({total}).from().where() -> [{total}]
 *
 * Since both queries share the same mock object, .where() is called twice.
 * The first .where() call (data query) must return `this` to continue chaining.
 * The second .where() call (count query) must resolve to [{total}].
 */
function setupListMocks(
  chain: ReturnType<typeof createMockDb>['_chain'],
  data: any[] = [],
  total: number | string = 0,
) {
  let whereCallCount = 0;
  chain.offset.mockResolvedValue(data);
  chain.where.mockImplementation(function (this: any) {
    whereCallCount++;
    // First .where() is for the data query (continues to .orderBy())
    // Second .where() is for the count query (terminal — resolves)
    if (whereCallCount >= 2) {
      return Promise.resolve([{ total }]);
    }
    return chain;
  });
}

const sampleNotification = {
  id: 'notif-1',
  userId: 'user-1',
  title: 'Test Title',
  body: 'Test Body',
  isRead: false,
  eventName: 'tasks.TaskCreated',
  entityType: 'task',
  entityId: 'task-1',
  createdAt: new Date('2026-04-01T00:00:00Z'),
};

describe('NotificationQueryService', () => {
  let service: NotificationQueryService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new NotificationQueryService(mockDb as any);
  });

  describe('listForUser', () => {
    it('should return data and total with default pagination', async () => {
      const notifications = [sampleNotification];
      setupListMocks(mockDb._chain, notifications, 1);

      const result = await service.listForUser('user-1');

      expect(result.data).toEqual(notifications);
      expect(result.total).toBe(1);
    });

    it('should apply default page=1 and limit=20', async () => {
      setupListMocks(mockDb._chain);

      await service.listForUser('user-1');

      expect(mockDb._chain.limit).toHaveBeenCalledWith(20);
      expect(mockDb._chain.offset).toHaveBeenCalledWith(0);
    });

    it('should apply custom page and limit', async () => {
      setupListMocks(mockDb._chain);

      await service.listForUser('user-1', { page: 3, limit: 10 });

      expect(mockDb._chain.limit).toHaveBeenCalledWith(10);
      expect(mockDb._chain.offset).toHaveBeenCalledWith(20); // (3-1) * 10
    });

    it('should call select twice (data + count)', async () => {
      setupListMocks(mockDb._chain);

      await service.listForUser('user-1');

      expect(mockDb._chain.select).toHaveBeenCalledTimes(2);
    });

    it('should call withTenant for tenant scoping', async () => {
      const { withTenant } = await import('@packages/tenancy/helpers');
      setupListMocks(mockDb._chain);

      await service.listForUser('user-1');

      expect(withTenant).toHaveBeenCalled();
    });

    it('should order by createdAt descending', async () => {
      setupListMocks(mockDb._chain);

      await service.listForUser('user-1');

      expect(mockDb._chain.orderBy).toHaveBeenCalled();
    });

    it('should convert total to number', async () => {
      setupListMocks(mockDb._chain, [], '42');

      const result = await service.listForUser('user-1');

      expect(result.total).toBe(42);
      expect(typeof result.total).toBe('number');
    });
  });

  describe('getUnreadCount', () => {
    it('should return the unread count as a number', async () => {
      mockDb._chain.where.mockResolvedValue([{ count: 5 }]);

      const result = await service.getUnreadCount('user-1');

      expect(result).toBe(5);
      expect(typeof result).toBe('number');
    });

    it('should call withTenant with userId and isRead=false conditions', async () => {
      const { withTenant } = await import('@packages/tenancy/helpers');

      mockDb._chain.where.mockResolvedValue([{ count: 0 }]);

      await service.getUnreadCount('user-1');

      expect(withTenant).toHaveBeenCalled();
    });

    it('should return 0 when no unread notifications', async () => {
      mockDb._chain.where.mockResolvedValue([{ count: 0 }]);

      const result = await service.getUnreadCount('user-1');

      expect(result).toBe(0);
    });

    it('should handle string count from database', async () => {
      mockDb._chain.where.mockResolvedValue([{ count: '15' }]);

      const result = await service.getUnreadCount('user-1');

      expect(result).toBe(15);
      expect(typeof result).toBe('number');
    });
  });

  describe('markAsRead', () => {
    it('should update isRead to true for the given notification and user', async () => {
      mockDb._chain.where.mockResolvedValue(undefined);

      await service.markAsRead('notif-1', 'user-1');

      expect(mockDb._chain.update).toHaveBeenCalled();
      expect(mockDb._chain.set).toHaveBeenCalledWith({ isRead: true });
      expect(mockDb._chain.where).toHaveBeenCalled();
    });

    it('should call withTenant with notificationId and userId conditions', async () => {
      const { withTenant } = await import('@packages/tenancy/helpers');

      mockDb._chain.where.mockResolvedValue(undefined);

      await service.markAsRead('notif-1', 'user-1');

      expect(withTenant).toHaveBeenCalled();
    });

    it('should propagate database errors', async () => {
      mockDb._chain.where.mockRejectedValue(new Error('Update failed'));

      await expect(service.markAsRead('notif-1', 'user-1')).rejects.toThrow('Update failed');
    });
  });

  describe('markAllAsRead', () => {
    it('should update isRead to true for all unread notifications', async () => {
      mockDb._chain.where.mockResolvedValue(undefined);

      await service.markAllAsRead('user-1');

      expect(mockDb._chain.update).toHaveBeenCalled();
      expect(mockDb._chain.set).toHaveBeenCalledWith({ isRead: true });
      expect(mockDb._chain.where).toHaveBeenCalled();
    });

    it('should call withTenant with userId and isRead=false conditions', async () => {
      const { withTenant } = await import('@packages/tenancy/helpers');

      mockDb._chain.where.mockResolvedValue(undefined);

      await service.markAllAsRead('user-1');

      expect(withTenant).toHaveBeenCalled();
    });

    it('should propagate database errors', async () => {
      mockDb._chain.where.mockRejectedValue(new Error('Bulk update failed'));

      await expect(service.markAllAsRead('user-1')).rejects.toThrow('Bulk update failed');
    });
  });
});
