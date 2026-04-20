import { describe, it, expect, vi } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import type { DatabaseService } from '@packages/database';
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

describe('PagesPublicService.getBySlug', () => {
  it('returns page + ordered sections when the slug exists', async () => {
    const { db } = buildDbMock([
      [{ id: 'p1', slug: 'home', title: 'Home', metaDescription: null, ogImage: null }],
      [
        { id: 's1', order: 0, blockKind: 'hero-split', variant: null, customFields: { headline: 'Hi' } },
        { id: 's2', order: 1, blockKind: 'cta', variant: 'centered', customFields: {} },
      ],
    ]);
    const service = new PagesPublicService(db);

    const result = await service.getBySlug('home');

    expect(result.page.id).toBe('p1');
    expect(result.page.slug).toBe('home');
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].blockKind).toBe('hero-split');
    expect(result.sections[0].customFields).toEqual({ headline: 'Hi' });
  });

  it('throws NotFoundException when no page matches', async () => {
    const { db } = buildDbMock([[]]);
    const service = new PagesPublicService(db);
    await expect(service.getBySlug('missing')).rejects.toThrow(NotFoundException);
  });

  it('coerces null customFields to an empty object', async () => {
    const { db } = buildDbMock([
      [{ id: 'p1', slug: 'home', title: 'Home', metaDescription: null, ogImage: null }],
      [{ id: 's1', order: 0, blockKind: 'text', variant: null, customFields: null }],
    ]);
    const service = new PagesPublicService(db);
    const result = await service.getBySlug('home');
    expect(result.sections[0].customFields).toEqual({});
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
    const service = new PagesPublicService(db);

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
    const { db } = buildDbMock([
      [{ id: 's1', pageId: 'p1' }],
    ]);
    const service = new PagesPublicService(db);
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
    const service = new PagesPublicService(db);
    await expect(
      service.reorder('p1', [
        { id: 's1', order: 0 },
        { id: 's2', order: 1 },
      ]),
    ).rejects.toThrow(BadRequestException);
  });
});
