import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderLineItemsService } from '../order-line-items.service';

vi.mock('@packages/tenancy/helpers', () => ({
  withTenant: vi.fn((_table: any, ...conditions: any[]) => conditions[0]),
  withTenantInsert: vi.fn((_table: any, data: any) => data),
}));

function createMockDb() {
  const returning = vi.fn();
  const orderBy = vi.fn().mockResolvedValue([]);
  const where = vi.fn().mockReturnValue({ orderBy });
  const values = vi.fn().mockReturnValue({ returning });
  const from = vi.fn().mockReturnValue({ where });

  return {
    db: {
      insert: vi.fn().mockReturnValue({ values }),
      select: vi.fn().mockReturnValue({ from }),
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    },
    _mocks: { returning, values, from, where, orderBy },
  };
}

describe('OrderLineItemsService', () => {
  let service: OrderLineItemsService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new OrderLineItemsService(mockDb as any);
  });

  it('should return empty array when no items to create', async () => {
    const result = await service.createMany([]);
    expect(result).toEqual([]);
    expect(mockDb.db.insert).not.toHaveBeenCalled();
  });

  it('should insert items and return results', async () => {
    const fakeRows = [{ id: 'li-1', orderId: 'ord-1', productId: 'p-1' }];
    mockDb._mocks.returning.mockResolvedValue(fakeRows);

    const result = await service.createMany([{
      orderId: 'ord-1',
      productId: 'p-1',
      productType: 'plan',
      productSnapshot: { name: 'Basic Plan' },
      quantity: 1,
      unitPrice: 1000,
      totalPrice: 1000,
    }]);

    expect(result).toBe(fakeRows);
    expect(mockDb.db.insert).toHaveBeenCalled();
  });

  it('should query line items by order ID', async () => {
    const fakeItems = [{ id: 'li-1' }, { id: 'li-2' }];
    mockDb._mocks.orderBy.mockResolvedValue(fakeItems);

    const result = await service.findByOrderId('ord-1');

    expect(result).toBe(fakeItems);
    expect(mockDb.db.select).toHaveBeenCalled();
  });

  it('should use provided transaction for createMany', async () => {
    const tx = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'li-1' }]),
        }),
      }),
    };

    await service.createMany([{
      orderId: 'ord-1',
      productId: 'p-1',
      productType: 'plan',
      productSnapshot: {},
      quantity: 1,
      unitPrice: 500,
      totalPrice: 500,
    }], tx);

    expect(tx.insert).toHaveBeenCalled();
    expect(mockDb.db.insert).not.toHaveBeenCalled();
  });
});
