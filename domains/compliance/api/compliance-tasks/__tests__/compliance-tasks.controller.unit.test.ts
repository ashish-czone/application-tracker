import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ComplianceTasksController } from '../compliance-tasks.controller';
import type { ComplianceTasksService } from '../compliance-tasks.service';

describe('ComplianceTasksController', () => {
  let service: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
  };
  let controller: ComplianceTasksController;

  beforeEach(() => {
    service = {
      create: vi.fn().mockResolvedValue({ id: 'task-1' }),
      update: vi.fn().mockResolvedValue({ id: 'task-1' }),
      delete: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
      findOne: vi.fn().mockResolvedValue({ id: 'task-1' }),
    };
    controller = new ComplianceTasksController(service as unknown as ComplianceTasksService);
  });

  describe('create', () => {
    it('delegates to ComplianceTasksService.create with the actor id', async () => {
      const dto = {
        title: 'GST Return',
        dueDate: '2026-05-20',
        ruleId: 'r1',
        clientId: 'c1',
        lawId: 'l1',
        periodStart: '2026-04-01',
        periodEnd: '2026-04-30',
      };
      await controller.create(dto as never, { userId: 'user-1' } as never);
      expect(service.create).toHaveBeenCalledWith(dto, 'user-1');
    });

    it('requires filings.create permission', () => {
      const permission = Reflect.getMetadata(
        'requiredPermission',
        ComplianceTasksController.prototype.create,
      );
      expect(permission).toBe('filings.create');
    });
  });

  describe('list', () => {
    it('passes pagination and filters to the service', async () => {
      await controller.list({
        clientId: 'c1',
        status: 'pending',
        limit: 25,
        offset: 50,
        orderBy: 'dueDate',
        direction: 'asc',
      } as never);

      expect(service.list).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'c1',
          status: ['pending'],
          limit: 25,
          offset: 50,
          orderBy: 'dueDate',
          direction: 'asc',
        }),
      );
    });

    it('splits a comma-separated status query into an array', async () => {
      await controller.list({ status: 'pending,in_progress' } as never);
      expect(service.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: ['pending', 'in_progress'] }),
      );
    });

    it('leaves status undefined when absent', async () => {
      await controller.list({} as never);
      expect(service.list).toHaveBeenCalledWith(expect.objectContaining({ status: undefined }));
    });

    it('requires filings.read permission', () => {
      const permission = Reflect.getMetadata(
        'requiredPermission',
        ComplianceTasksController.prototype.list,
      );
      expect(permission).toBe('filings.read');
    });
  });

  describe('findOne', () => {
    it('returns the row when found', async () => {
      service.findOne.mockResolvedValue({ id: 'task-1', title: 'x' });
      const result = await controller.findOne('task-1');
      expect(result).toEqual({ id: 'task-1', title: 'x' });
    });

    it('throws NotFoundException when the service returns null', async () => {
      service.findOne.mockResolvedValue(null);
      await expect(controller.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('requires filings.read permission', () => {
      const permission = Reflect.getMetadata(
        'requiredPermission',
        ComplianceTasksController.prototype.findOne,
      );
      expect(permission).toBe('filings.read');
    });
  });

  describe('update', () => {
    it('delegates to ComplianceTasksService.update with the actor id', async () => {
      await controller.update('task-1', { title: 'new' } as never, { userId: 'user-1' } as never);
      expect(service.update).toHaveBeenCalledWith('task-1', { title: 'new' }, 'user-1');
    });

    it('requires filings.update permission', () => {
      const permission = Reflect.getMetadata(
        'requiredPermission',
        ComplianceTasksController.prototype.update,
      );
      expect(permission).toBe('filings.update');
    });
  });

  describe('delete', () => {
    it('delegates to ComplianceTasksService.delete with the actor id', async () => {
      await controller.delete('task-1', { userId: 'user-1' } as never);
      expect(service.delete).toHaveBeenCalledWith('task-1', 'user-1');
    });

    it('requires filings.delete permission', () => {
      const permission = Reflect.getMetadata(
        'requiredPermission',
        ComplianceTasksController.prototype.delete,
      );
      expect(permission).toBe('filings.delete');
    });
  });
});
