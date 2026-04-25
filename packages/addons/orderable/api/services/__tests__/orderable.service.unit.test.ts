import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderableService } from '../orderable.service';

vi.mock('@packages/tenancy/helpers', () => ({
  withTenant: vi.fn((_table: any, ...conditions: any[]) => conditions[0]),
}));

function createMockDb() {
  const chain = {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  return chain;
}

const mockTable = {} as any;
const mockIdCol = {} as any;
const mockSortOrderCol = {} as any;

describe('OrderableService', () => {
  let service: OrderableService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new OrderableService({ db: mockDb } as any);
  });

  describe('setSortOrder', () => {
    it('writes an absolute sort_order value to the row', async () => {
      await service.setSortOrder(mockTable, mockIdCol, mockSortOrderCol, 'node-1', 2048);

      expect(mockDb.update).toHaveBeenCalledWith(mockTable);
      expect(mockDb.set).toHaveBeenCalledWith({ sortOrder: 2048 });
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('accepts zero as a valid sort_order', async () => {
      await service.setSortOrder(mockTable, mockIdCol, mockSortOrderCol, 'node-1', 0);

      expect(mockDb.set).toHaveBeenCalledWith({ sortOrder: 0 });
    });

    it('accepts negative sort_order values (caller may prepend to a list)', async () => {
      await service.setSortOrder(mockTable, mockIdCol, mockSortOrderCol, 'node-1', -1024);

      expect(mockDb.set).toHaveBeenCalledWith({ sortOrder: -1024 });
    });
  });
});
