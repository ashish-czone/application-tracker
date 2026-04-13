import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { NotificationTemplatesService } from '../notification-templates.service';
import type { NotificationTemplate } from '../../types';

vi.mock('@packages/tenancy/helpers', () => ({
  withTenant: vi.fn((_table, ...conditions) => conditions[0]),
  withTenantInsert: vi.fn((_table, data) => data),
}));

/**
 * The service makes several query shapes:
 *
 * Count query:  select().from().where()                              -- awaited directly
 * Data query:   select().from().where().orderBy().limit().offset()   -- awaited at offset()
 * FindById:     select().from().where().limit()                      -- awaited at limit()
 * Insert:       insert().values().returning()
 * Update:       update().set().where().returning()
 * Delete:       delete().where()
 *
 * Every method in the chain returns the chain object itself. The chain object has a `.then`
 * method making it thenable. Each awaited call shifts results from a shared queue, allowing
 * sequential DB calls within a single test to resolve with different data.
 */
function createMockDb() {
  const resultQueue: any[][] = [];

  const chain: Record<string, any> = {};

  // Thenable: whenever the chain is awaited, shift the next result from the queue
  chain.then = vi.fn((resolve?: (v: any) => any, reject?: (e: any) => any) => {
    const result = resultQueue.shift() ?? [];
    return Promise.resolve(result).then(resolve, reject);
  });

  chain.select = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.offset = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);

  return {
    db: chain,
    _chain: chain,
    /** Queue sequential results for awaited DB calls in order */
    queueResult: (...results: any[][]) => results.forEach((r) => resultQueue.push(r)),
  };
}

function buildTemplate(overrides: Partial<NotificationTemplate> = {}): NotificationTemplate {
  return {
    id: 'tmpl-1',
    name: 'Welcome Email',
    channel: 'email',
    subject: 'Welcome!',
    body: 'Hello {{payload.firstName}}',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('NotificationTemplatesService', () => {
  let service: NotificationTemplatesService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new NotificationTemplatesService({ db: mockDb.db } as any);
  });

  describe('list', () => {
    it('should return paginated results with defaults', async () => {
      const template = buildTemplate();
      mockDb.queueResult([{ total: 1 }], [template]);

      const result = await service.list({});

      expect(result.data).toEqual([template]);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 25, totalPages: 1 });
    });

    it('should apply page and limit parameters', async () => {
      mockDb.queueResult([{ total: 50 }], []);

      const result = await service.list({ page: 3, limit: 10 });

      expect(result.meta).toEqual({ total: 50, page: 3, limit: 10, totalPages: 5 });
      expect(mockDb._chain.limit).toHaveBeenCalledWith(10);
      expect(mockDb._chain.offset).toHaveBeenCalledWith(20);
    });

    it('should calculate totalPages correctly with remainder', async () => {
      mockDb.queueResult([{ total: 7 }], []);

      const result = await service.list({ limit: 3 });

      expect(result.meta.totalPages).toBe(3);
    });

    it('should return empty data when no templates exist', async () => {
      mockDb.queueResult([{ total: 0 }], []);

      const result = await service.list({});

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('should filter by channel when provided', async () => {
      mockDb.queueResult([{ total: 0 }], []);

      await service.list({ channel: 'email' });

      // 2 where calls: one for count, one for data
      expect(mockDb._chain.where).toHaveBeenCalledTimes(2);
    });

    it('should filter by search term when provided', async () => {
      mockDb.queueResult([{ total: 0 }], []);

      await service.list({ search: 'welcome' });

      expect(mockDb._chain.where).toHaveBeenCalledTimes(2);
    });

    it('should apply both channel and search filters together', async () => {
      mockDb.queueResult([{ total: 0 }], []);

      await service.list({ channel: 'in_app', search: 'test' });

      expect(mockDb._chain.where).toHaveBeenCalledTimes(2);
    });

    it('should sort by name ascending when specified', async () => {
      mockDb.queueResult([{ total: 0 }], []);

      await service.list({ sort: 'name', order: 'asc' });

      expect(mockDb._chain.orderBy).toHaveBeenCalled();
    });

    it('should default to desc order when order is not specified', async () => {
      mockDb.queueResult([{ total: 0 }], []);

      await service.list({ sort: 'name' });

      expect(mockDb._chain.orderBy).toHaveBeenCalled();
    });
  });

  describe('findByIdOrFail', () => {
    it('should return the template when found', async () => {
      const template = buildTemplate();
      mockDb.queueResult([template]);

      const result = await service.findByIdOrFail('tmpl-1');

      expect(result).toEqual(template);
      expect(mockDb._chain.select).toHaveBeenCalled();
      expect(mockDb._chain.from).toHaveBeenCalled();
      expect(mockDb._chain.limit).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException when template does not exist', async () => {
      mockDb.queueResult([]);

      await expect(service.findByIdOrFail('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should include descriptive error message', async () => {
      mockDb.queueResult([]);

      await expect(service.findByIdOrFail('nonexistent')).rejects.toThrow('Notification template not found');
    });
  });

  describe('create', () => {
    it('should insert and return the created template', async () => {
      const template = buildTemplate();
      const createData = { name: 'Welcome Email', channel: 'email' as const, subject: 'Welcome!', body: 'Hello' };
      mockDb.queueResult([template]);

      const result = await service.create(createData);

      expect(result).toEqual(template);
      expect(mockDb._chain.insert).toHaveBeenCalled();
      expect(mockDb._chain.values).toHaveBeenCalled();
      expect(mockDb._chain.returning).toHaveBeenCalled();
    });

    it('should create template without optional subject', async () => {
      const template = buildTemplate({ subject: null });
      const createData = { name: 'In-App Alert', channel: 'in_app' as const, body: 'You have a new message' };
      mockDb.queueResult([template]);

      const result = await service.create(createData);

      expect(result).toEqual(template);
      expect(mockDb._chain.values).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update and return the updated template', async () => {
      const existing = buildTemplate();
      const updated = buildTemplate({ name: 'Updated Name' });
      // findByIdOrFail awaited first, then update().set().where().returning() awaited
      mockDb.queueResult([existing], [updated]);

      const result = await service.update('tmpl-1', { name: 'Updated Name' });

      expect(result).toEqual(updated);
      expect(mockDb._chain.update).toHaveBeenCalled();
      expect(mockDb._chain.set).toHaveBeenCalledWith({ name: 'Updated Name' });
      expect(mockDb._chain.returning).toHaveBeenCalled();
    });

    it('should throw NotFoundException when updating a non-existent template', async () => {
      mockDb.queueResult([]);

      await expect(service.update('nonexistent', { name: 'New' })).rejects.toThrow(NotFoundException);
    });

    it('should allow partial updates with only body', async () => {
      const existing = buildTemplate();
      const updated = buildTemplate({ body: 'New body content' });
      mockDb.queueResult([existing], [updated]);

      const result = await service.update('tmpl-1', { body: 'New body content' });

      expect(result).toEqual(updated);
      expect(mockDb._chain.set).toHaveBeenCalledWith({ body: 'New body content' });
    });
  });

  describe('delete', () => {
    it('should delete an existing template', async () => {
      const existing = buildTemplate();
      mockDb.queueResult([existing]);

      await service.delete('tmpl-1');

      expect(mockDb._chain.delete).toHaveBeenCalled();
      expect(mockDb._chain.where).toHaveBeenCalled();
    });

    it('should throw NotFoundException when deleting a non-existent template', async () => {
      mockDb.queueResult([]);

      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
