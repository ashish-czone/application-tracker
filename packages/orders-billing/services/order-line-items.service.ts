import { Injectable } from '@nestjs/common';
import { DatabaseService, eq } from '@packages/database';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import { orderLineItems } from '../schema/order-line-items';
import type { OrderLineItemRecord } from '../types';

export interface CreateLineItemRow {
  orderId: string;
  productId: string;
  productType: string;
  productSnapshot: Record<string, unknown>;
  description?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  metadata?: Record<string, unknown>;
  sortOrder?: number;
}

@Injectable()
export class OrderLineItemsService {
  constructor(private readonly database: DatabaseService) {}

  async createMany(items: CreateLineItemRow[], tx?: any): Promise<OrderLineItemRecord[]> {
    if (items.length === 0) return [];

    const db = tx ?? this.database.db;
    const rows = await db
      .insert(orderLineItems)
      .values(withTenantInsert(orderLineItems, items.map((item, idx) => ({
        orderId: item.orderId,
        productId: item.productId,
        productType: item.productType,
        productSnapshot: item.productSnapshot,
        description: item.description ?? null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        metadata: item.metadata ?? null,
        sortOrder: item.sortOrder ?? idx,
      }))))
      .returning();

    return rows;
  }

  async findByOrderId(orderId: string): Promise<OrderLineItemRecord[]> {
    return this.database.db
      .select()
      .from(orderLineItems)
      .where(withTenant(orderLineItems, eq(orderLineItems.orderId, orderId)))
      .orderBy(orderLineItems.sortOrder);
  }

  async deleteByOrderId(orderId: string, tx?: any): Promise<void> {
    const db = tx ?? this.database.db;
    await db
      .delete(orderLineItems)
      .where(withTenant(orderLineItems, eq(orderLineItems.orderId, orderId)));
  }

  async deleteById(id: string, tx?: any): Promise<void> {
    const db = tx ?? this.database.db;
    await db
      .delete(orderLineItems)
      .where(withTenant(orderLineItems, eq(orderLineItems.id, id)));
  }
}
