import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import type { DatabaseService } from '@packages/database';
import type { ModuleRef } from '@nestjs/core';
import type { EntityRegistryService } from '@packages/entity-engine';
import { mapperRegistry, defineMapper } from '@packages/blocks-contract';
import { PagesPublicService } from '../services/pages-public.service';

function buildDbMock(responses: any[][]) {
  let callIdx = 0;
  const transactionCalls: Array<{ op: string; values?: any; where?: any }> = [];
  const chain: any = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: (resolve: any) => Promise.resolve(responses[callIdx++] ?? []).then(resolve),
    transaction: vi.fn(async (fn: (tx: any) => Promise<void>) => {
      const tx = {
        update: vi.fn(() => tx),
        set: vi.fn((v: any) => {
          transactionCalls.push({ op: 'set', values: v });
          return tx;
        }),
        where: vi.fn(() => Promise.resolve()),
      };
      await fn(tx);
    }),
  };
  return { db: { db: chain } as unknown as DatabaseService, transactionCalls };
}

const noopLogger = {
  forContext: () => ({
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
  }),
} as any;

const emptyRegistry: EntityRegistryService = {
  getBySlug: () => undefined,
  get: () => undefined,
} as any;

const emptyModuleRef: ModuleRef = {
  get: () => {
    throw new Error('no service');
  },
} as any;

describe('PagesPublicService.getBySlug', () => {
  beforeEach(() => {
    mapperRegistry.clear();
  });

  it('returns page + ordered sections with static sections resolved to empty data', async () => {
    const { db } = buildDbMock([
      [{ id: 'p1', slug: 'home', title: 'Home', metaDescription: null, ogImage: null }],
      [
        {
          id: 's1',
          order: 0,
          blockKind: 'hero-split',
          variant: null,
          title: 'Welcome',
          dataSource: null,
          customFields: { headline: 'Hi' },
        },
        {
          id: 's2',
          order: 1,
          blockKind: 'cta',
          variant: 'centered',
          title: null,
          dataSource: { kind: 'static' },
          customFields: {},
        },
      ],
    ]);
    const service = new PagesPublicService(db, emptyModuleRef, emptyRegistry, noopLogger);

    const result = await service.getBySlug('home');

    expect(result.page.slug).toBe('home');
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0]).toMatchObject({
      id: 's1',
      blockKind: 'hero-split',
      title: 'Welcome',
      customFields: { headline: 'Hi' },
      data: {},
    });
    expect(result.sections[1]).toMatchObject({
      id: 's2',
      variant: 'centered',
      title: null,
      data: {},
    });
  });

  it('throws NotFoundException when no page matches', async () => {
    const { db } = buildDbMock([[]]);
    const service = new PagesPublicService(db, emptyModuleRef, emptyRegistry, noopLogger);
    await expect(service.getBySlug('missing')).rejects.toThrow(NotFoundException);
  });

  it('coerces null customFields to an empty object', async () => {
    const { db } = buildDbMock([
      [{ id: 'p1', slug: 'home', title: 'Home', metaDescription: null, ogImage: null }],
      [
        {
          id: 's1',
          order: 0,
          blockKind: 'text',
          variant: null,
          title: null,
          dataSource: null,
          customFields: null,
        },
      ],
    ]);
    const service = new PagesPublicService(db, emptyModuleRef, emptyRegistry, noopLogger);
    const result = await service.getBySlug('home');
    expect(result.sections[0].customFields).toEqual({});
  });

  it('resolves entity-query data source through the registered mapper', async () => {
    const { db } = buildDbMock([
      [{ id: 'p1', slug: 'home', title: 'Home', metaDescription: null, ogImage: null }],
      [
        {
          id: 's1',
          order: 0,
          blockKind: 'testimonials-grid',
          variant: null,
          title: 'What they say',
          dataSource: { kind: 'entity-query', entity: 'testimonials', limit: 3 },
          customFields: {},
        },
      ],
    ]);

    const entityService = {
      list: vi.fn(async () => ({
        data: [
          { id: 't1', quote: 'Great!', author: 'Alice' },
          { id: 't2', quote: 'Loved it', author: 'Bob' },
        ],
        meta: { total: 2, page: 1, limit: 3, totalPages: 1 },
      })),
    };
    const moduleRef = { get: () => entityService } as unknown as ModuleRef;
    const registry = {
      getBySlug: (slug: string) =>
        slug === 'testimonials' ? { entityType: 'testimonials' } : undefined,
      get: () => undefined,
    } as unknown as EntityRegistryService;

    mapperRegistry.register(
      defineMapper<{ id: string; quote: string; author: string }, { items: { quote: string }[] }>({
        entity: 'testimonials',
        block: 'testimonials-grid',
        map: (records) => ({ items: records.map((r) => ({ quote: r.quote })) }),
      }),
    );

    const service = new PagesPublicService(db, moduleRef, registry, noopLogger);
    const result = await service.getBySlug('home');

    expect(entityService.list).toHaveBeenCalledWith({ limit: 3 });
    expect(result.sections[0].data).toEqual({
      items: [{ quote: 'Great!' }, { quote: 'Loved it' }],
    });
  });

  it('preserves entity-ids ordering even when the engine returns records unordered', async () => {
    const { db } = buildDbMock([
      [{ id: 'p1', slug: 'home', title: 'Home', metaDescription: null, ogImage: null }],
      [
        {
          id: 's1',
          order: 0,
          blockKind: 'team-grid',
          variant: null,
          title: null,
          dataSource: { kind: 'entity-ids', entity: 'team', ids: ['b', 'a', 'c'] },
          customFields: {},
        },
      ],
    ]);

    const entityService = {
      list: vi.fn(async () => ({
        data: [
          { id: 'c', name: 'Carol' },
          { id: 'a', name: 'Alice' },
          { id: 'b', name: 'Bob' },
        ],
        meta: { total: 3, page: 1, limit: 3, totalPages: 1 },
      })),
    };
    const moduleRef = { get: () => entityService } as unknown as ModuleRef;
    const registry = {
      getBySlug: (slug: string) => (slug === 'team' ? { entityType: 'team' } : undefined),
      get: () => undefined,
    } as unknown as EntityRegistryService;

    mapperRegistry.register(
      defineMapper<{ id: string; name: string }, { members: string[] }>({
        entity: 'team',
        block: 'team-grid',
        map: (records) => ({ members: records.map((r) => r.name) }),
      }),
    );

    const service = new PagesPublicService(db, moduleRef, registry, noopLogger);
    const result = await service.getBySlug('home');

    expect(result.sections[0].data).toEqual({ members: ['Bob', 'Alice', 'Carol'] });
  });

  it('returns empty data when no mapper is registered for the (entity, block) pair', async () => {
    const { db } = buildDbMock([
      [{ id: 'p1', slug: 'home', title: 'Home', metaDescription: null, ogImage: null }],
      [
        {
          id: 's1',
          order: 0,
          blockKind: 'unknown-block',
          variant: null,
          title: null,
          dataSource: { kind: 'entity-query', entity: 'testimonials', limit: 1 },
          customFields: {},
        },
      ],
    ]);
    const entityService = {
      list: vi.fn(async () => ({ data: [{ id: 't1' }], meta: { total: 1, page: 1, limit: 1, totalPages: 1 } })),
    };
    const moduleRef = { get: () => entityService } as unknown as ModuleRef;
    const registry = {
      getBySlug: () => ({ entityType: 'testimonials' }),
      get: () => undefined,
    } as unknown as EntityRegistryService;

    const service = new PagesPublicService(db, moduleRef, registry, noopLogger);
    const result = await service.getBySlug('home');
    expect(result.sections[0].data).toEqual({});
  });

  it('swallows mapper errors so one broken section does not break the page', async () => {
    const { db } = buildDbMock([
      [{ id: 'p1', slug: 'home', title: 'Home', metaDescription: null, ogImage: null }],
      [
        {
          id: 's1',
          order: 0,
          blockKind: 'exploding-block',
          variant: null,
          title: null,
          dataSource: { kind: 'entity-query', entity: 'testimonials', limit: 1 },
          customFields: {},
        },
      ],
    ]);
    const entityService = {
      list: vi.fn(async () => ({ data: [{ id: 't1' }], meta: { total: 1, page: 1, limit: 1, totalPages: 1 } })),
    };
    const moduleRef = { get: () => entityService } as unknown as ModuleRef;
    const registry = {
      getBySlug: () => ({ entityType: 'testimonials' }),
      get: () => undefined,
    } as unknown as EntityRegistryService;

    mapperRegistry.register(
      defineMapper({
        entity: 'testimonials',
        block: 'exploding-block',
        map: () => {
          throw new Error('boom');
        },
      }),
    );

    const service = new PagesPublicService(db, moduleRef, registry, noopLogger);
    const result = await service.getBySlug('home');
    expect(result.sections[0].data).toEqual({});
  });

  it('parses "-createdAt" sort shorthand into sort + order=desc', async () => {
    const { db } = buildDbMock([
      [{ id: 'p1', slug: 'home', title: 'Home', metaDescription: null, ogImage: null }],
      [
        {
          id: 's1',
          order: 0,
          blockKind: 'faq-accordion',
          variant: null,
          title: null,
          dataSource: {
            kind: 'entity-query',
            entity: 'faq',
            sort: '-createdAt',
            limit: 5,
          },
          customFields: {},
        },
      ],
    ]);
    const entityService = {
      list: vi.fn(async () => ({ data: [], meta: { total: 0, page: 1, limit: 5, totalPages: 0 } })),
    };
    const moduleRef = { get: () => entityService } as unknown as ModuleRef;
    const registry = {
      getBySlug: () => ({ entityType: 'faq' }),
      get: () => undefined,
    } as unknown as EntityRegistryService;

    const service = new PagesPublicService(db, moduleRef, registry, noopLogger);
    await service.getBySlug('home');

    expect(entityService.list).toHaveBeenCalledWith({
      limit: 5,
      sort: 'createdAt',
      order: 'desc',
    });
  });
});

describe('PagesPublicService.reorder', () => {
  it('runs one update per section in a transaction', async () => {
    const { db, transactionCalls } = buildDbMock([
      [
        { id: 's1', pageId: 'p1' },
        { id: 's2', pageId: 'p1' },
      ],
    ]);
    const service = new PagesPublicService(db, emptyModuleRef, emptyRegistry, noopLogger);

    await service.reorder('p1', [
      { id: 's1', order: 1 },
      { id: 's2', order: 0 },
    ]);

    expect(transactionCalls).toEqual([
      { op: 'set', values: { order: 1 } },
      { op: 'set', values: { order: 0 } },
    ]);
  });

  it('throws NotFoundException when an id is missing', async () => {
    const { db } = buildDbMock([[{ id: 's1', pageId: 'p1' }]]);
    const service = new PagesPublicService(db, emptyModuleRef, emptyRegistry, noopLogger);
    await expect(
      service.reorder('p1', [
        { id: 's1', order: 0 },
        { id: 'missing', order: 1 },
      ]),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when a section belongs to a different page', async () => {
    const { db } = buildDbMock([
      [
        { id: 's1', pageId: 'p1' },
        { id: 's2', pageId: 'other-page' },
      ],
    ]);
    const service = new PagesPublicService(db, emptyModuleRef, emptyRegistry, noopLogger);
    await expect(
      service.reorder('p1', [
        { id: 's1', order: 0 },
        { id: 's2', order: 1 },
      ]),
    ).rejects.toThrow(BadRequestException);
  });
});
