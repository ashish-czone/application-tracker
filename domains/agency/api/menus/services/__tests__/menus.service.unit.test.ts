import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MenusService } from '../menus.service';

describe('MenusService', () => {
  let entityService: any;
  let service: MenusService;

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
    service = new MenusService(entityService);
  });

  it('list forwards query + accessCtx', () => {
    service.list({ page: 1 } as never, { userId: 'u' } as never);
    expect(entityService.list).toHaveBeenCalledWith({ page: 1 }, { userId: 'u' });
  });
  it('findOne forwards id + accessCtx', () => {
    service.findOne('m1', { userId: 'u' } as never);
    expect(entityService.findOneOrFail).toHaveBeenCalledWith('m1', { userId: 'u' });
  });
  it('create forwards input + actorId', () => {
    service.create({ name: 'Primary', slug: 'primary' } as never, 'actor-1');
    expect(entityService.create).toHaveBeenCalledWith({ name: 'Primary', slug: 'primary' }, 'actor-1');
  });
  it('update forwards id + input + actorId + accessCtx', () => {
    service.update('m1', { name: 'X' } as never, 'actor-1');
    expect(entityService.update).toHaveBeenCalledWith('m1', { name: 'X' }, 'actor-1', undefined);
  });
  it('softDelete forwards id + actorId + accessCtx', () => {
    service.softDelete('m1', 'actor-1');
    expect(entityService.softDelete).toHaveBeenCalledWith('m1', 'actor-1', undefined);
  });
  it('clone forwards', () => {
    service.clone('m1', 'actor-1');
    expect(entityService.clone).toHaveBeenCalledWith('m1', 'actor-1');
  });
  it('restore forwards', () => {
    service.restore('m1');
    expect(entityService.restore).toHaveBeenCalledWith('m1');
  });
  it('getListLayout forwards', () => {
    service.getListLayout();
    expect(entityService.getListLayout).toHaveBeenCalled();
  });
});
