import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SectionsService } from '../sections.service';

describe('SectionsService', () => {
  let entityService: {
    list: ReturnType<typeof vi.fn>;
    findOneOrFail: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
    clone: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
    getListLayout: ReturnType<typeof vi.fn>;
  };
  let service: SectionsService;

  beforeEach(() => {
    entityService = {
      list: vi.fn(),
      findOneOrFail: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      clone: vi.fn(),
      restore: vi.fn(),
      getListLayout: vi.fn(),
    };
    service = new SectionsService(entityService as never);
  });

  it('list forwards query + accessCtx', () => {
    service.list({ page: 1 } as never);
    expect(entityService.list).toHaveBeenCalledWith({ page: 1 }, undefined);
  });

  it('create forwards input + actorId', () => {
    service.create({ pageId: 'p1', blockKind: 'hero', order: 1 } as never, 'actor-1');
    expect(entityService.create).toHaveBeenCalledWith({ pageId: 'p1', blockKind: 'hero', order: 1 }, 'actor-1');
  });

  it('update forwards id + input + actorId + accessCtx', () => {
    service.update('s1', { title: 'New' } as never, 'actor-1', { userId: 'u' } as never);
    expect(entityService.update).toHaveBeenCalledWith('s1', { title: 'New' }, 'actor-1', { userId: 'u' });
  });

  it('softDelete forwards id + actorId + accessCtx', () => {
    service.softDelete('s1', 'actor-1');
    expect(entityService.softDelete).toHaveBeenCalledWith('s1', 'actor-1', undefined);
  });

  it('restore forwards id', () => {
    service.restore('s1');
    expect(entityService.restore).toHaveBeenCalledWith('s1');
  });

  it('getListLayout forwards to entityService', () => {
    service.getListLayout();
    expect(entityService.getListLayout).toHaveBeenCalled();
  });
});
