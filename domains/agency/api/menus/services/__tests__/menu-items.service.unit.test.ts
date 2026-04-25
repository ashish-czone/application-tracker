import { BadRequestException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MenuItemsService } from '../menu-items.service';
import { registerMenuItemDepthLookup } from '../../menu-items.config';
import { menuItems } from '../../schema/menu-items';

describe('MenuItemsService', () => {
  let entityService: any;
  let database: any;
  let hierarchy: any;
  let orderable: any;
  let service: MenuItemsService;

  beforeEach(() => {
    entityService = {
      list: vi.fn(),
      findOneOrFail: vi.fn().mockResolvedValue({ id: 'i1', path: '/i1' }),
      create: vi.fn().mockResolvedValue({ id: 'new-id' }),
      update: vi.fn(),
      softDelete: vi.fn(),
      clone: vi.fn(),
      restore: vi.fn(),
      getListLayout: vi.fn(),
    };
    // Drizzle-style chainable mocks. Different fluent chains end at limit() or
    // where() so we let both terminate in the same selection by default.
    const limitMock = vi.fn().mockResolvedValue([]);
    const whereSelect = vi.fn().mockReturnValue({ limit: limitMock });
    const fromSelect = vi.fn().mockReturnValue({ where: whereSelect });
    const select = vi.fn().mockReturnValue({ from: fromSelect });
    const setUpdate = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    const update = vi.fn().mockReturnValue({ set: setUpdate });
    database = { db: { select, update }, _selectLimit: limitMock };
    hierarchy = {
      computeInsertValues: vi.fn().mockReturnValue({ path: '/new-id', depth: 0 }),
      move: vi.fn().mockResolvedValue(undefined),
      getAncestors: vi.fn().mockResolvedValue([]),
      getDescendants: vi.fn().mockResolvedValue([]),
    };
    orderable = {
      setSortOrder: vi.fn().mockResolvedValue(undefined),
    };
    service = new MenuItemsService(entityService, database, hierarchy, orderable);
    registerMenuItemDepthLookup(async () => 0);
  });

  describe('create', () => {
    it('with no parentId computes root path/depth', async () => {
      const payload = { menuId: 'm1', label: 'Home', linkType: 'url', url: '/home' };
      await service.create(payload as never, 'actor-1');
      expect(entityService.create).toHaveBeenCalledWith(payload, 'actor-1');
      expect(hierarchy.computeInsertValues).toHaveBeenCalledWith(null, 'new-id');
      expect(database.db.update).toHaveBeenCalledWith(menuItems);
    });

    it('with parentId resolves parent path before insert', async () => {
      database._selectLimit.mockResolvedValueOnce([{ id: 'p1', path: '/p1' }]);
      const payload = { menuId: 'm1', label: 'Sub', linkType: 'url', url: '/x', parentId: 'p1' };
      await service.create(payload as never, 'actor-1');
      expect(hierarchy.computeInsertValues).toHaveBeenCalledWith('/p1', 'new-id');
      expect(entityService.create).toHaveBeenCalledWith(payload, 'actor-1');
    });

    it('rejects when parentId not found', async () => {
      database._selectLimit.mockResolvedValueOnce([]);
      const payload = { menuId: 'm1', label: 'Sub', linkType: 'url', url: '/x', parentId: 'missing' };
      await expect(service.create(payload as never, 'actor-1')).rejects.toThrow(BadRequestException);
      expect(entityService.create).not.toHaveBeenCalled();
    });

    it('rejects when linkType=url but url is missing', async () => {
      await expect(
        service.create({ menuId: 'm1', label: 'Home', linkType: 'url' } as never, 'actor-1'),
      ).rejects.toThrow(BadRequestException);
      expect(entityService.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('forwards', async () => {
      await service.update('i1', { label: 'X' } as never, 'actor-1');
      expect(entityService.update).toHaveBeenCalledWith('i1', { label: 'X' }, 'actor-1', undefined);
    });
    it('rejects invalid target', async () => {
      await expect(
        service.update('i1', { target: 'nope' } as never, 'actor-1'),
      ).rejects.toThrow(BadRequestException);
      expect(entityService.update).not.toHaveBeenCalled();
    });
  });

  describe('reparent', () => {
    it('makes node a root when parentId is null', async () => {
      database._selectLimit.mockResolvedValueOnce([{ id: 'i1', path: '/old' }]);
      await service.reparent('i1', null, 'actor-1');
      expect(hierarchy.move).toHaveBeenCalledWith(
        menuItems,
        menuItems.id,
        menuItems.parentId,
        menuItems.path,
        menuItems.depth,
        'i1',
        '/old',
        null,
        null,
      );
    });

    it('moves under a new parent', async () => {
      database._selectLimit
        .mockResolvedValueOnce([{ id: 'i1', path: '/i1' }]) // node lookup
        .mockResolvedValueOnce([{ id: 'p1', path: '/p1' }]); // parent lookup
      await service.reparent('i1', 'p1', 'actor-1');
      expect(hierarchy.move).toHaveBeenCalledWith(
        menuItems, menuItems.id, menuItems.parentId, menuItems.path, menuItems.depth,
        'i1', '/i1', 'p1', '/p1',
      );
    });
  });

  describe('getAncestors / getDescendants', () => {
    it('getAncestors delegates to HierarchyService with the node path', async () => {
      entityService.findOneOrFail.mockResolvedValueOnce({ id: 'i1', path: '/i1' });
      await service.getAncestors('i1');
      expect(hierarchy.getAncestors).toHaveBeenCalledWith(menuItems, menuItems.id, menuItems.path, '/i1');
    });
    it('getDescendants delegates to HierarchyService with the node path', async () => {
      entityService.findOneOrFail.mockResolvedValueOnce({ id: 'i1', path: '/i1' });
      await service.getDescendants('i1');
      expect(hierarchy.getDescendants).toHaveBeenCalledWith(menuItems, menuItems.path, '/i1');
    });
  });

  describe('move', () => {
    it('rejects empty body', async () => {
      await expect(service.move('i1', {}, 'actor-1')).rejects.toThrow(BadRequestException);
    });

    it('routes parentId to reparent', async () => {
      database._selectLimit.mockResolvedValueOnce([{ id: 'i1', path: '/i1' }]);
      await service.move('i1', { parentId: null }, 'actor-1');
      expect(hierarchy.move).toHaveBeenCalled();
      expect(orderable.setSortOrder).not.toHaveBeenCalled();
    });

    it('routes sortOrder to OrderableService', async () => {
      await service.move('i1', { sortOrder: 100 }, 'actor-1');
      expect(orderable.setSortOrder).toHaveBeenCalledWith(menuItems, menuItems.id, menuItems.sortOrder, 'i1', 100);
      expect(hierarchy.move).not.toHaveBeenCalled();
    });

    it('handles combined parentId + sortOrder', async () => {
      database._selectLimit.mockResolvedValueOnce([{ id: 'i1', path: '/i1' }]);
      await service.move('i1', { parentId: null, sortOrder: 5 }, 'actor-1');
      expect(hierarchy.move).toHaveBeenCalled();
      expect(orderable.setSortOrder).toHaveBeenCalled();
    });
  });
});
