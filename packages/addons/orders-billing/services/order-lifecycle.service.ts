import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService, eq } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import { randomUUID } from 'crypto';
import { orders } from '../schema/orders';
import { orderLineItems } from '../schema/order-line-items';
import { ProductResolverRegistry } from './product-resolver-registry';
import { BillingClientResolverRegistry } from './billing-client-resolver-registry';
import { OrderLifecycleHookRegistry } from './order-lifecycle-hook-registry';
import { OrderLineItemsService, type CreateLineItemRow } from './order-line-items.service';
import {
  ORDERS_ORDER_CREATED,
  ORDER_STATUS,
  type CreateOrderInput,
  type AddLineItemInput,
  type OrderRecord,
  type OrderLineItemRecord,
} from '../types';

@Injectable()
export class OrderLifecycleService {
  private readonly logger: ContextLogger;

  constructor(
    private readonly database: DatabaseService,
    private readonly productResolverRegistry: ProductResolverRegistry,
    private readonly billingClientResolverRegistry: BillingClientResolverRegistry,
    private readonly lifecycleHookRegistry: OrderLifecycleHookRegistry,
    private readonly lineItemsService: OrderLineItemsService,
    private readonly domainEventEmitter: DomainEventEmitter,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(OrderLifecycleService.name);
  }

  async createOrder(input: CreateOrderInput, actorId: string): Promise<OrderRecord> {
    let enrichedInput = await this.lifecycleHookRegistry.runBeforeCreate(input);

    const client = await this.billingClientResolverRegistry.resolve(
      enrichedInput.clientId,
      enrichedInput.clientType,
    );
    if (!client) {
      throw new BadRequestException(`Client not found: ${enrichedInput.clientId}`);
    }

    if (enrichedInput.lineItems.length === 0) {
      throw new BadRequestException('Order must have at least one line item');
    }

    const resolvedItems: CreateLineItemRow[] = [];
    let totalAmount = 0;

    for (const item of enrichedInput.lineItems) {
      const product = await this.productResolverRegistry.resolve(item.productId, item.productType);
      if (!product) {
        throw new BadRequestException(
          `Product not found: ${item.productId} (type: ${item.productType})`,
        );
      }

      const unitPrice = product.unitPrice;
      const totalPrice = unitPrice * item.quantity;
      totalAmount += totalPrice;

      resolvedItems.push({
        orderId: '', // set after order insert
        productId: item.productId,
        productType: item.productType,
        productSnapshot: product as unknown as Record<string, unknown>,
        description: item.description ?? product.name,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        metadata: item.metadata,
      });
    }

    const orderNumber = this.generateOrderNumber();

    const order = await this.database.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(orders)
        .values(withTenantInsert(orders, {
          orderNumber,
          status: ORDER_STATUS.DRAFT,
          clientId: enrichedInput.clientId,
          clientType: enrichedInput.clientType ?? null,
          totalAmount,
          currency: enrichedInput.currency,
          notes: enrichedInput.notes ?? null,
          metadata: enrichedInput.metadata ?? null,
          expiresAt: enrichedInput.expiresAt ?? null,
          createdBy: actorId,
        }))
        .returning();

      const itemsWithOrderId = resolvedItems.map((item) => ({
        ...item,
        orderId: row.id,
      }));

      await this.lineItemsService.createMany(itemsWithOrderId, tx);

      return row;
    });

    await this.lifecycleHookRegistry.runAfterCreate(order);

    this.domainEventEmitter.emit(ORDERS_ORDER_CREATED, {
      entityType: 'orders',
      entityId: order.id,
      actorId,
      payload: {
        after: order as unknown as Record<string, unknown>,
        lineItems: resolvedItems.map((item) => ({
          productId: item.productId,
          productType: item.productType,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
      },
    });

    this.logger.log(`Order created: ${order.orderNumber} (${order.id})`);

    return order;
  }

  async addLineItem(orderId: string, input: AddLineItemInput, actorId: string): Promise<OrderLineItemRecord> {
    const order = await this.findOrderOrFail(orderId);

    if (order.status !== ORDER_STATUS.DRAFT) {
      throw new BadRequestException('Line items can only be added to draft orders');
    }

    const product = await this.productResolverRegistry.resolve(input.productId, input.productType);
    if (!product) {
      throw new BadRequestException(
        `Product not found: ${input.productId} (type: ${input.productType})`,
      );
    }

    const unitPrice = product.unitPrice;
    const totalPrice = unitPrice * input.quantity;

    const [lineItem] = await this.database.db.transaction(async (tx) => {
      const items = await this.lineItemsService.createMany([{
        orderId,
        productId: input.productId,
        productType: input.productType,
        productSnapshot: product as unknown as Record<string, unknown>,
        description: input.description ?? product.name,
        quantity: input.quantity,
        unitPrice,
        totalPrice,
        metadata: input.metadata,
      }], tx);

      await tx
        .update(orders)
        .set({
          totalAmount: order.totalAmount + totalPrice,
        })
        .where(withTenant(orders, eq(orders.id, orderId)));

      return items;
    });

    return lineItem;
  }

  async removeLineItem(orderId: string, lineItemId: string, actorId: string): Promise<void> {
    const order = await this.findOrderOrFail(orderId);

    if (order.status !== ORDER_STATUS.DRAFT) {
      throw new BadRequestException('Line items can only be removed from draft orders');
    }

    const lineItems = await this.lineItemsService.findByOrderId(orderId);
    const lineItem = lineItems.find((li) => li.id === lineItemId);

    if (!lineItem) {
      throw new NotFoundException(`Line item not found: ${lineItemId}`);
    }

    if (lineItems.length === 1) {
      throw new BadRequestException('Cannot remove the last line item from an order');
    }

    await this.database.db.transaction(async (tx) => {
      await this.lineItemsService.deleteById(lineItemId, tx);

      await tx
        .update(orders)
        .set({
          totalAmount: order.totalAmount - lineItem.totalPrice,
        })
        .where(withTenant(orders, eq(orders.id, orderId)));
    });
  }

  async getOrderWithLineItems(orderId: string): Promise<{ order: OrderRecord; lineItems: OrderLineItemRecord[] }> {
    const order = await this.findOrderOrFail(orderId);
    const lineItems = await this.lineItemsService.findByOrderId(orderId);
    return { order, lineItems };
  }

  private async findOrderOrFail(orderId: string): Promise<OrderRecord> {
    const [order] = await this.database.db
      .select()
      .from(orders)
      .where(withTenant(orders, eq(orders.id, orderId)))
      .limit(1);

    if (!order) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }

    return order;
  }

  private generateOrderNumber(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = randomUUID().slice(0, 6).toUpperCase();
    return `ORD-${date}-${suffix}`;
  }
}
