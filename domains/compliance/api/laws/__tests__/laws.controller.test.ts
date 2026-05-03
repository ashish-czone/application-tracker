import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LawsController } from '../laws.controller';
import type { LawsService } from '../laws.service';

describe('LawsController', () => {
  let laws: {
    list: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    getTree: ReturnType<typeof vi.fn>;
    getOptions: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
  };
  let controller: LawsController;

  beforeEach(() => {
    laws = {
      list: vi.fn().mockResolvedValue({ data: [], meta: {} }),
      findOne: vi.fn().mockResolvedValue({ id: 'l1' }),
      getTree: vi.fn().mockResolvedValue({ tree: [], counts: {} }),
      getOptions: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'l1' }),
      update: vi.fn().mockResolvedValue({ id: 'l1' }),
      softDelete: vi.fn().mockResolvedValue(undefined),
    };
    controller = new LawsController(laws as unknown as LawsService);
  });

  it('options endpoint parses query and forwards parsed query + access context', async () => {
    const accessCtx = { userId: 'u1', scopes: [{ type: 'any' }] } as never;
    await controller.options({ search: 'gst', limit: '10' }, accessCtx);
    expect(laws.getOptions).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'gst', limit: 10 }),
      accessCtx,
    );
  });

  it('options endpoint clamps limit to 50 (typeahead bound)', async () => {
    await controller.options({ limit: '500' }, undefined);
    const call = laws.getOptions.mock.calls[0][0];
    expect(call.limit).toBe(50);
  });

  it('options endpoint splits ids CSV into an array', async () => {
    await controller.options({ ids: 'l1,l2,l3' }, undefined);
    const call = laws.getOptions.mock.calls[0][0];
    expect(call.ids).toEqual(['l1', 'l2', 'l3']);
  });

  it('options endpoint requires laws.read', () => {
    const permission = Reflect.getMetadata('requiredPermission', LawsController.prototype.options);
    expect(permission).toBe('laws.read');
  });
});
