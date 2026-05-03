import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LawsService } from '../laws.service';

describe('LawsService.getOptions', () => {
  let crud: { list: ReturnType<typeof vi.fn> };
  let database: { db: { select: ReturnType<typeof vi.fn> } };
  let service: LawsService;

  function mockSelectChain(rows: unknown[]) {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(rows),
    };
    database.db.select = vi.fn().mockReturnValue(chain);
    return chain;
  }

  beforeEach(() => {
    crud = { list: vi.fn() };
    database = { db: { select: vi.fn() } };
    service = new LawsService(crud as never, database as never);
  });

  it('returns rows from the select chain limited to the requested limit', async () => {
    const chain = mockSelectChain([
      { id: 'l1', code: 'GST-101', name: 'GST Filing' },
      { id: 'l2', code: 'PF-200', name: 'PF Returns' },
    ]);
    const result = await service.getOptions({ limit: 25 });
    expect(result).toEqual([
      { id: 'l1', code: 'GST-101', name: 'GST Filing' },
      { id: 'l2', code: 'PF-200', name: 'PF Returns' },
    ]);
    expect(chain.limit).toHaveBeenCalledWith(25);
  });

  it('passes a where clause when search is provided', async () => {
    const chain = mockSelectChain([]);
    await service.getOptions({ limit: 25, search: 'gst' });
    expect(chain.where).toHaveBeenCalled();
  });

  it('hydrates labels by id when ids are provided (search is ignored)', async () => {
    const chain = mockSelectChain([{ id: 'l1', code: 'GST-101', name: 'GST Filing' }]);
    await service.getOptions({ limit: 25, ids: ['l1', 'l2'], search: 'gst' });
    expect(chain.where).toHaveBeenCalled();
  });
});
