import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService, eq, isNull } from '@packages/database';
import { DomainEventEmitter } from '@packages/events';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { WorkflowEngineService, PipelineResolverService } from '@packages/workflows';
import { withTenant, withTenantInsert } from '@packages/tenancy/helpers';
import { addMonths, addYears } from 'date-fns';
import { randomUUID } from 'crypto';
import { subscriptions } from '../schema/subscriptions';
import { subscriptionPlans } from '../schema/subscription-plans';
import {
  SUBSCRIPTION_STATUS,
  SUBSCRIPTIONS_ACTIVATED,
  SUBSCRIPTIONS_RENEWED,
  type CreateSubscriptionInput,
  type SubscriptionRecord,
  type SubscriptionPlanRecord,
} from '../types';

@Injectable()
export class SubscriptionLifecycleService {
  private readonly logger: ContextLogger;

  constructor(
    private readonly database: DatabaseService,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly pipelineResolver: PipelineResolverService,
    private readonly domainEventEmitter: DomainEventEmitter,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(SubscriptionLifecycleService.name);
  }

  async createSubscription(input: CreateSubscriptionInput, actorId: string): Promise<SubscriptionRecord> {
    const plan = await this.findPlanOrFail(input.planId);

    const planSnapshot = {
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      price: plan.price,
      currency: plan.currency,
      interval: plan.interval,
      intervalCount: plan.intervalCount,
      capabilities: plan.capabilities,
      limits: plan.limits,
    };

    const [subscription] = await this.database.db
      .insert(subscriptions)
      .values(withTenantInsert(subscriptions, {
        id: randomUUID(),
        clientId: input.clientId,
        clientType: input.clientType ?? null,
        planId: input.planId,
        planSnapshot,
        orderId: input.orderId ?? null,
        orderLineItemId: input.orderLineItemId ?? null,
        status: SUBSCRIPTION_STATUS.PENDING_ACTIVATION,
        autoRenew: true,
        metadata: input.metadata ?? null,
      }))
      .returning();

    this.logger.log('Subscription created', {
      subscriptionId: subscription.id,
      planId: input.planId,
      clientId: input.clientId,
    });

    if (input.activateImmediately) {
      return this.activateSubscription(subscription.id, actorId);
    }

    return subscription;
  }

  async activateSubscription(subscriptionId: string, actorId: string): Promise<SubscriptionRecord> {
    const subscription = await this.findSubscriptionOrFail(subscriptionId);

    const validated = await this.validateTransition(
      subscription,
      SUBSCRIPTION_STATUS.ACTIVE,
      actorId,
    );

    const snapshot = subscription.planSnapshot as Record<string, unknown>;
    const now = new Date();
    const periodEnd = this.computeNextPeriodEnd(now, snapshot.interval as string, snapshot.intervalCount as number);

    const [updated] = await this.database.db.transaction(async (tx) => {
      const [row] = await tx
        .update(subscriptions)
        .set({
          status: SUBSCRIPTION_STATUS.ACTIVE,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        })
        .where(withTenant(subscriptions, eq(subscriptions.id, subscriptionId)))
        .returning();

      await this.workflowEngine.recordHistory({
        workflowDefinitionId: validated.workflowDefinitionId,
        entityType: 'subscriptions',
        entityId: subscriptionId,
        fieldName: validated.fieldName,
        fromState: subscription.status,
        toState: SUBSCRIPTION_STATUS.ACTIVE,
        transitionId: validated.transitionId,
        actorId,
      }, tx);

      return [row];
    });

    this.emitStatusChanged(subscriptionId, subscription.status, SUBSCRIPTION_STATUS.ACTIVE, validated, actorId);

    this.domainEventEmitter.emit(SUBSCRIPTIONS_ACTIVATED, {
      entityType: 'subscriptions',
      entityId: subscriptionId,
      actorId,
      payload: {
        after: updated as unknown as Record<string, unknown>,
        planId: updated.planId,
        clientId: updated.clientId,
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: periodEnd.toISOString(),
      },
    });

    this.logger.log('Subscription activated', { subscriptionId, actorId });
    return updated;
  }

  async renewSubscription(subscriptionId: string, actorId: string): Promise<SubscriptionRecord> {
    const subscription = await this.findSubscriptionOrFail(subscriptionId);

    if (subscription.status !== SUBSCRIPTION_STATUS.ACTIVE) {
      throw new BadRequestException('Only active subscriptions can be renewed');
    }

    if (!subscription.currentPeriodEnd) {
      throw new BadRequestException('Subscription has no current period end date');
    }

    const snapshot = subscription.planSnapshot as Record<string, unknown>;
    const interval = snapshot.interval as string;

    if (interval === 'one_time') {
      throw new BadRequestException('One-time subscriptions cannot be renewed');
    }

    const previousPeriodEnd = subscription.currentPeriodEnd;
    const newPeriodEnd = this.computeNextPeriodEnd(
      previousPeriodEnd,
      interval,
      snapshot.intervalCount as number,
    );

    const [updated] = await this.database.db
      .update(subscriptions)
      .set({
        currentPeriodStart: previousPeriodEnd,
        currentPeriodEnd: newPeriodEnd,
      })
      .where(withTenant(subscriptions, eq(subscriptions.id, subscriptionId)))
      .returning();

    this.domainEventEmitter.emit(SUBSCRIPTIONS_RENEWED, {
      entityType: 'subscriptions',
      entityId: subscriptionId,
      actorId,
      payload: {
        subscriptionId,
        planId: subscription.planId,
        clientId: subscription.clientId,
        previousPeriodEnd: previousPeriodEnd.toISOString(),
        newPeriodEnd: newPeriodEnd.toISOString(),
      },
    });

    this.logger.log('Subscription renewed', {
      subscriptionId,
      previousPeriodEnd: previousPeriodEnd.toISOString(),
      newPeriodEnd: newPeriodEnd.toISOString(),
    });

    return updated;
  }

  async cancelSubscription(subscriptionId: string, actorId: string): Promise<SubscriptionRecord> {
    const subscription = await this.findSubscriptionOrFail(subscriptionId);

    const validated = await this.validateTransition(
      subscription,
      SUBSCRIPTION_STATUS.CANCELLED,
      actorId,
    );

    const [updated] = await this.database.db.transaction(async (tx) => {
      const [row] = await tx
        .update(subscriptions)
        .set({
          status: SUBSCRIPTION_STATUS.CANCELLED,
          cancelledAt: new Date(),
        })
        .where(withTenant(subscriptions, eq(subscriptions.id, subscriptionId)))
        .returning();

      await this.workflowEngine.recordHistory({
        workflowDefinitionId: validated.workflowDefinitionId,
        entityType: 'subscriptions',
        entityId: subscriptionId,
        fieldName: validated.fieldName,
        fromState: subscription.status,
        toState: SUBSCRIPTION_STATUS.CANCELLED,
        transitionId: validated.transitionId,
        actorId,
      }, tx);

      return [row];
    });

    this.emitStatusChanged(subscriptionId, subscription.status, SUBSCRIPTION_STATUS.CANCELLED, validated, actorId);

    this.logger.log('Subscription cancelled', { subscriptionId, actorId });
    return updated;
  }

  async pauseSubscription(subscriptionId: string, actorId: string): Promise<SubscriptionRecord> {
    const subscription = await this.findSubscriptionOrFail(subscriptionId);

    const validated = await this.validateTransition(
      subscription,
      SUBSCRIPTION_STATUS.PAUSED,
      actorId,
    );

    const [updated] = await this.database.db.transaction(async (tx) => {
      const [row] = await tx
        .update(subscriptions)
        .set({ status: SUBSCRIPTION_STATUS.PAUSED })
        .where(withTenant(subscriptions, eq(subscriptions.id, subscriptionId)))
        .returning();

      await this.workflowEngine.recordHistory({
        workflowDefinitionId: validated.workflowDefinitionId,
        entityType: 'subscriptions',
        entityId: subscriptionId,
        fieldName: validated.fieldName,
        fromState: subscription.status,
        toState: SUBSCRIPTION_STATUS.PAUSED,
        transitionId: validated.transitionId,
        actorId,
      }, tx);

      return [row];
    });

    this.emitStatusChanged(subscriptionId, subscription.status, SUBSCRIPTION_STATUS.PAUSED, validated, actorId);

    this.logger.log('Subscription paused', { subscriptionId, actorId });
    return updated;
  }

  async resumeSubscription(subscriptionId: string, actorId: string): Promise<SubscriptionRecord> {
    const subscription = await this.findSubscriptionOrFail(subscriptionId);

    const validated = await this.validateTransition(
      subscription,
      SUBSCRIPTION_STATUS.ACTIVE,
      actorId,
    );

    const [updated] = await this.database.db.transaction(async (tx) => {
      const [row] = await tx
        .update(subscriptions)
        .set({ status: SUBSCRIPTION_STATUS.ACTIVE })
        .where(withTenant(subscriptions, eq(subscriptions.id, subscriptionId)))
        .returning();

      await this.workflowEngine.recordHistory({
        workflowDefinitionId: validated.workflowDefinitionId,
        entityType: 'subscriptions',
        entityId: subscriptionId,
        fieldName: validated.fieldName,
        fromState: subscription.status,
        toState: SUBSCRIPTION_STATUS.ACTIVE,
        transitionId: validated.transitionId,
        actorId,
      }, tx);

      return [row];
    });

    this.emitStatusChanged(subscriptionId, subscription.status, SUBSCRIPTION_STATUS.ACTIVE, validated, actorId);

    this.logger.log('Subscription resumed', { subscriptionId, actorId });
    return updated;
  }

  async expireSubscription(subscriptionId: string, actorId: string): Promise<SubscriptionRecord> {
    const subscription = await this.findSubscriptionOrFail(subscriptionId);

    const validated = await this.validateTransition(
      subscription,
      SUBSCRIPTION_STATUS.EXPIRED,
      actorId,
    );

    const [updated] = await this.database.db.transaction(async (tx) => {
      const [row] = await tx
        .update(subscriptions)
        .set({ status: SUBSCRIPTION_STATUS.EXPIRED })
        .where(withTenant(subscriptions, eq(subscriptions.id, subscriptionId)))
        .returning();

      await this.workflowEngine.recordHistory({
        workflowDefinitionId: validated.workflowDefinitionId,
        entityType: 'subscriptions',
        entityId: subscriptionId,
        fieldName: validated.fieldName,
        fromState: subscription.status,
        toState: SUBSCRIPTION_STATUS.EXPIRED,
        transitionId: validated.transitionId,
        actorId,
      }, tx);

      return [row];
    });

    this.emitStatusChanged(subscriptionId, subscription.status, SUBSCRIPTION_STATUS.EXPIRED, validated, actorId);

    this.logger.log('Subscription expired', { subscriptionId, actorId });
    return updated;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async findPlanOrFail(planId: string): Promise<SubscriptionPlanRecord> {
    const [plan] = await this.database.db
      .select()
      .from(subscriptionPlans)
      .where(
        withTenant(
          subscriptionPlans,
          eq(subscriptionPlans.id, planId),
          isNull(subscriptionPlans.deletedAt),
        ),
      )
      .limit(1);

    if (!plan) {
      throw new NotFoundException(`Subscription plan not found: ${planId}`);
    }
    return plan;
  }

  private async findSubscriptionOrFail(subscriptionId: string): Promise<SubscriptionRecord> {
    const [subscription] = await this.database.db
      .select()
      .from(subscriptions)
      .where(
        withTenant(
          subscriptions,
          eq(subscriptions.id, subscriptionId),
          isNull(subscriptions.deletedAt),
        ),
      )
      .limit(1);

    if (!subscription) {
      throw new NotFoundException(`Subscription not found: ${subscriptionId}`);
    }
    return subscription;
  }

  private async validateTransition(
    subscription: SubscriptionRecord,
    toState: string,
    actorId: string,
  ) {
    const workflow = await this.pipelineResolver.resolveForTransition(
      'subscriptions',
      subscription.id,
      'status',
    );

    if (!workflow) {
      throw new BadRequestException('No workflow found for subscriptions status field');
    }

    return this.workflowEngine.validateAndThrow({
      workflowSlug: workflow.slug,
      entityType: 'subscriptions',
      entityId: subscription.id,
      fromState: subscription.status,
      toState,
      actorId,
    });
  }

  private emitStatusChanged(
    subscriptionId: string,
    fromState: string,
    toState: string,
    validated: { transitionId: string; transitionName: string; fieldName: string },
    actorId: string,
  ) {
    this.domainEventEmitter.emitDynamic('subscriptions.StatusChanged', {
      entityType: 'subscriptions',
      entityId: subscriptionId,
      actorId,
      payload: {
        workflowSlug: 'subscription-status',
        fieldName: validated.fieldName,
        fromState,
        toState,
        transitionId: validated.transitionId,
        transitionName: validated.transitionName,
      },
    });
  }

  private computeNextPeriodEnd(from: Date, interval: string, intervalCount: number): Date {
    switch (interval) {
      case 'monthly':
        return addMonths(from, intervalCount);
      case 'yearly':
        return addYears(from, intervalCount);
      case 'one_time':
        return from;
      default:
        throw new BadRequestException(`Unknown interval: ${interval}`);
    }
  }
}
