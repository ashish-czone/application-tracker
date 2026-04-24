import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PagesService } from '../pages.service';

describe('PagesService', () => {
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
  let service: PagesService;

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
    service = new PagesService(entityService as never);
  });

  it('list forwards query + accessCtx', () => {
    service.list({ page: 1 } as never, { userId: 'u' } as never);
    expect(entityService.list).toHaveBeenCalledWith({ page: 1 }, { userId: 'u' });
  });

  it('findOne forwards id + accessCtx', () => {
    service.findOne('p1', { userId: 'u' } as never);
    expect(entityService.findOneOrFail).toHaveBeenCalledWith('p1', { userId: 'u' });
  });

  it('create forwards input + actorId', () => {
    service.create({ slug: 'home', title: 'Home' } as never, 'actor-1');
    expect(entityService.create).toHaveBeenCalledWith({ slug: 'home', title: 'Home' }, 'actor-1');
  });

  it('update forwards id + input + actorId + accessCtx', () => {
    service.update('p1', { title: 'New' } as never, 'actor-1', { userId: 'u' } as never);
    expect(entityService.update).toHaveBeenCalledWith('p1', { title: 'New' }, 'actor-1', { userId: 'u' });
  });

  it('softDelete forwards id + actorId + accessCtx', () => {
    service.softDelete('p1', 'actor-1', { userId: 'u' } as never);
    expect(entityService.softDelete).toHaveBeenCalledWith('p1', 'actor-1', { userId: 'u' });
  });

  it('clone forwards id + actorId', () => {
    service.clone('p1', 'actor-1');
    expect(entityService.clone).toHaveBeenCalledWith('p1', 'actor-1');
  });

  it('restore forwards id', () => {
    service.restore('p1');
    expect(entityService.restore).toHaveBeenCalledWith('p1');
  });

  it('getListLayout forwards to entityService', () => {
    service.getListLayout();
    expect(entityService.getListLayout).toHaveBeenCalled();
  });
});
