import { BadRequestException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MenuItemsService } from '../menu-items.service';
import { registerMenuItemDepthLookup } from '../../menu-items.config';

describe('MenuItemsService', () => {
  let entityService: any;
  let service: MenuItemsService;

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
      reparent: vi.fn(),
      getAncestors: vi.fn(),
      getDescendants: vi.fn(),
      move: vi.fn(),
    };
    service = new MenuItemsService(entityService);
    // No parent → no depth lookup is invoked, so the registered lookup can stay a no-op.
    registerMenuItemDepthLookup(async () => 0);
  });

  it('list forwards query + accessCtx', () => {
    service.list({ page: 1 } as never);
    expect(entityService.list).toHaveBeenCalledWith({ page: 1 }, undefined);
  });
  it('create forwards input + actorId', async () => {
    const payload = { menuId: 'm1', label: 'Home', linkType: 'url', url: '/home' };
    await service.create(payload as never, 'actor-1');
    expect(entityService.create).toHaveBeenCalledWith(payload, 'actor-1');
  });
  it('create rejects when linkType=url but url is missing', async () => {
    await expect(
      service.create({ menuId: 'm1', label: 'Home', linkType: 'url' } as never, 'actor-1'),
    ).rejects.toThrow(BadRequestException);
    expect(entityService.create).not.toHaveBeenCalled();
  });
  it('update forwards', async () => {
    await service.update('i1', { label: 'X' } as never, 'actor-1');
    expect(entityService.update).toHaveBeenCalledWith('i1', { label: 'X' }, 'actor-1', undefined);
  });
  it('update rejects invalid target', async () => {
    await expect(
      service.update('i1', { target: 'nope' } as never, 'actor-1'),
    ).rejects.toThrow(BadRequestException);
    expect(entityService.update).not.toHaveBeenCalled();
  });
  it('reparent forwards id + parentId + actorId', () => {
    service.reparent('i1', 'parent-1', 'actor-1');
    expect(entityService.reparent).toHaveBeenCalledWith('i1', 'parent-1', 'actor-1', undefined);
  });
  it('getAncestors forwards', () => {
    service.getAncestors('i1');
    expect(entityService.getAncestors).toHaveBeenCalledWith('i1', undefined);
  });
  it('getDescendants forwards', () => {
    service.getDescendants('i1');
    expect(entityService.getDescendants).toHaveBeenCalledWith('i1', undefined);
  });
  it('move forwards id + body + actorId', () => {
    service.move('i1', { parentId: 'p1', sortOrder: 5 }, 'actor-1');
    expect(entityService.move).toHaveBeenCalledWith('i1', { parentId: 'p1', sortOrder: 5 }, 'actor-1', undefined);
  });
});
