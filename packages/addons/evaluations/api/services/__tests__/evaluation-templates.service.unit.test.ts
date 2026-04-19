import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { EvaluationTemplatesService } from '../evaluation-templates.service';

vi.mock('@packages/tenancy/helpers', () => ({
  withTenant: vi.fn((_table: unknown, ...conditions: unknown[]) => conditions[0]),
  withTenantInsert: vi.fn((_table: unknown, data: unknown) => data),
}));

function createMockDb() {
  const resolveQueue: unknown[] = [];

  const mockChain: Record<string, any> = {
    _enqueue: (...values: unknown[]) => { resolveQueue.push(...values); },
  };

  const methods = [
    'select', 'from', 'where', 'limit', 'offset', 'orderBy',
    'insert', 'values', 'set', 'returning', 'update', 'delete',
  ];

  for (const method of methods) {
    mockChain[method] = vi.fn().mockReturnValue(mockChain);
  }

  mockChain.then = (
    resolve: (v: unknown) => void,
    _reject?: (e: unknown) => void,
  ) => {
    const value = resolveQueue.length > 0 ? resolveQueue.shift() : undefined;
    resolve(value);
  };

  return { db: mockChain, _chain: mockChain };
}

function makeTemplate(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 't1',
    slug: 'tech-interview',
    name: 'Technical Interview',
    entityType: 'interviews',
    criteria: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('EvaluationTemplatesService', () => {
  let service: EvaluationTemplatesService;
  let db: ReturnType<typeof createMockDb>['db'];
  let _chain: ReturnType<typeof createMockDb>['_chain'];

  beforeEach(() => {
    const mock = createMockDb();
    db = mock.db;
    _chain = mock._chain;
    service = new EvaluationTemplatesService({ db } as any);
  });

  describe('create', () => {
    it('should create a template and return it', async () => {
      const template = makeTemplate();
      _chain._enqueue([template]); // insert().values().returning()

      const result = await service.create({
        slug: 'tech-interview',
        name: 'Technical Interview',
        entityType: 'interviews',
        criteria: [],
      });

      expect(result).toEqual(template);
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update and return the template', async () => {
      const template = makeTemplate({ name: 'Updated Name' });
      _chain._enqueue([template]); // update().set().where().returning()

      const result = await service.update('t1', { name: 'Updated Name' });
      expect(result.name).toBe('Updated Name');
    });

    it('should throw NotFoundException if not found', async () => {
      _chain._enqueue([]); // returning() returns empty

      await expect(service.update('nonexistent', { name: 'x' }))
        .rejects.toThrow(NotFoundException);
    });

    it('should return existing template if no fields to update', async () => {
      const template = makeTemplate();
      vi.spyOn(service, 'findByIdOrFail').mockResolvedValueOnce(template as any);

      const result = await service.update('t1', {});
      expect(result).toEqual(template);
    });
  });

  describe('findByIdOrFail', () => {
    it('should return the template when found', async () => {
      const template = makeTemplate();
      _chain._enqueue([template]); // select().from().where().limit()

      const result = await service.findByIdOrFail('t1');
      expect(result).toEqual(template);
    });

    it('should throw NotFoundException when not found', async () => {
      _chain._enqueue([]); // empty result

      await expect(service.findByIdOrFail('nonexistent'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should throw NotFoundException if template not found', async () => {
      vi.spyOn(service, 'findByIdOrFail').mockRejectedValueOnce(new NotFoundException());

      await expect(service.delete('nonexistent'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if evaluations exist', async () => {
      vi.spyOn(service, 'findByIdOrFail').mockResolvedValueOnce(makeTemplate() as any);
      _chain._enqueue([{ total: 5 }]); // count evaluations

      await expect(service.delete('t1'))
        .rejects.toThrow(ConflictException);
    });

    it('should delete when no evaluations exist', async () => {
      vi.spyOn(service, 'findByIdOrFail').mockResolvedValueOnce(makeTemplate() as any);
      _chain._enqueue([{ total: 0 }]); // count evaluations
      _chain._enqueue(undefined); // delete

      await expect(service.delete('t1')).resolves.toBeUndefined();
      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe('findBySlug', () => {
    it('should return template when found by slug', async () => {
      const template = makeTemplate();
      _chain._enqueue([template]); // select().from().where().limit()

      const result = await service.findBySlug('tech-interview');
      expect(result).toEqual(template);
    });

    it('should return null when slug not found', async () => {
      _chain._enqueue([]); // empty

      const result = await service.findBySlug('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('should return paginated results with defaults', async () => {
      const templates = [makeTemplate({ id: 't1' }), makeTemplate({ id: 't2', slug: 'b' })];
      // Promise.all resolves the chain twice:
      // Query 1 (rows): select().from().where().limit().offset()
      // Query 2 (count): select().from().where()
      _chain._enqueue(templates);
      _chain._enqueue([{ total: 2 }]);

      const result = await service.list({});

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(25);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should respect custom page and limit', async () => {
      _chain._enqueue([]);
      _chain._enqueue([{ total: 50 }]);

      const result = await service.list({ page: 3, limit: 10 });

      expect(result.meta.page).toBe(3);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.total).toBe(50);
      expect(result.meta.totalPages).toBe(5);
    });

    it('should calculate totalPages correctly with partial last page', async () => {
      _chain._enqueue([]);
      _chain._enqueue([{ total: 7 }]);

      const result = await service.list({ limit: 3 });

      expect(result.meta.totalPages).toBe(3); // ceil(7/3) = 3
    });

    it('should filter by entityType when provided', async () => {
      _chain._enqueue([]);
      _chain._enqueue([{ total: 0 }]);

      await service.list({ entityType: 'interviews' });

      expect(_chain.where).toHaveBeenCalled();
    });

    it('should filter by isActive when provided', async () => {
      _chain._enqueue([]);
      _chain._enqueue([{ total: 0 }]);

      await service.list({ isActive: true });

      expect(_chain.where).toHaveBeenCalled();
    });

    it('should return empty data with zero total', async () => {
      _chain._enqueue([]);
      _chain._enqueue([{ total: 0 }]);

      const result = await service.list({});

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });
  });

  describe('ensureTemplate', () => {
    it('should return existing template if slug exists', async () => {
      const template = makeTemplate();
      vi.spyOn(service, 'findBySlug').mockResolvedValueOnce(template as any);

      const result = await service.ensureTemplate({
        slug: 'tech-interview',
        name: 'Technical Interview',
        entityType: 'interviews',
        criteria: [],
      });

      expect(result).toEqual(template);
      expect(db.insert).not.toHaveBeenCalled();
    });

    it('should create template if slug does not exist', async () => {
      const template = makeTemplate({ criteria: [{ name: 'Problem Solving', description: 'test' }] });
      vi.spyOn(service, 'findBySlug').mockResolvedValueOnce(null);
      _chain._enqueue([template]); // create → returning

      const result = await service.ensureTemplate({
        slug: 'tech-interview',
        name: 'Technical Interview',
        entityType: 'interviews',
        criteria: [{ name: 'Problem Solving', description: 'test' }],
      });

      expect(result).toEqual(template);
      expect(db.insert).toHaveBeenCalled();
    });
  });
});
