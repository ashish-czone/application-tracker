import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MediaAssetsService } from '../media-assets.service';

describe('MediaAssetsService', () => {
  let entityService: any;
  let service: MediaAssetsService;

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
    service = new MediaAssetsService(entityService);
  });

  it('list forwards query + accessCtx', () => {
    service.list({ page: 1 } as never);
    expect(entityService.list).toHaveBeenCalledWith({ page: 1 }, undefined);
  });
  it('findOne forwards', () => {
    service.findOne('m1');
    expect(entityService.findOneOrFail).toHaveBeenCalledWith('m1', undefined);
  });
  it('create forwards', () => {
    service.create({ storageKey: 'k', url: 'u', originalName: 'n', mimeType: 'image/png', size: 100, createdBy: 'u1' } as never, 'a1');
    expect(entityService.create).toHaveBeenCalledWith(expect.objectContaining({ storageKey: 'k' }), 'a1');
  });
  it('update forwards', () => {
    service.update('m1', { altText: 'X' } as never, 'a1');
    expect(entityService.update).toHaveBeenCalledWith('m1', { altText: 'X' }, 'a1', undefined);
  });
  it('softDelete forwards', () => {
    service.softDelete('m1', 'a1');
    expect(entityService.softDelete).toHaveBeenCalledWith('m1', 'a1', undefined);
  });
  it('clone forwards', () => {
    service.clone('m1', 'a1');
    expect(entityService.clone).toHaveBeenCalledWith('m1', 'a1');
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
