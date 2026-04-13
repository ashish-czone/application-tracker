import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import type { DomainEvent } from '@packages/events';
import {
  isPayloadCondition,
  evaluatePayloadConditions,
  evaluateConditionsInMemory,
} from '@packages/common';
import { ActionRegistry } from '@packages/automation-contracts';
import { interpolateValues } from '../helpers/interpolator';
import type { AutomationRule, LifecycleUpdateBinding, LifecycleDeleteBinding } from '@packages/automation-contracts';
import { AutomationRuleService } from './automation-rule.service';
import { ProvenanceService } from './provenance.service';

@Injectable()
export class LifecycleEngine {
  private readonly logger: ContextLogger;

  constructor(
    private readonly ruleService: AutomationRuleService,
    private readonly actionRegistry: ActionRegistry,
    private readonly provenanceService: ProvenanceService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(LifecycleEngine.name);
  }

  @OnEvent('**')
  async handleDomainEvent(event: DomainEvent): Promise<void> {
    try {
      const rules = await this.ruleService.findActiveWithLifecycleBindings();
      if (rules.length === 0) return;

      const isDeleteEvent = event.eventName.endsWith('Deleted');

      for (const rule of rules) {
        // Only process rules whose trigger event entity type matches this event's entity type
        if (!this.ruleMatchesEntityType(rule, event.entityType)) continue;

        if (isDeleteEvent && rule.onSourceDeleted && rule.onSourceDeleted.length > 0) {
          await this.processDeleteBindings(rule, event);
        } else if (!isDeleteEvent && rule.onSourceUpdated && rule.onSourceUpdated.length > 0) {
          await this.processUpdateBindings(rule, event);
        }
      }
    } catch (error) {
      this.logger.error('Lifecycle engine error', {
        eventName: event.eventName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private ruleMatchesEntityType(rule: AutomationRule, eventEntityType: string): boolean {
    if (!rule.eventName) return false;
    // Extract entity type from event name (e.g., 'interviews.InterviewScheduled' → 'interviews')
    const ruleEntityType = rule.eventName.split('.')[0];
    return ruleEntityType === eventEntityType;
  }

  private async processUpdateBindings(rule: AutomationRule, event: DomainEvent): Promise<void> {
    if (!rule.onSourceUpdated) return;

    for (const binding of rule.onSourceUpdated) {
      await this.processUpdateBinding(rule, binding, event);
    }
  }

  private async processUpdateBinding(
    rule: AutomationRule,
    binding: LifecycleUpdateBinding,
    event: DomainEvent,
  ): Promise<void> {
    // Evaluate binding conditions
    if (binding.conditions && binding.conditions.length > 0) {
      const payload = event.payload as {
        changes?: string[];
        before?: Record<string, unknown>;
        after?: Record<string, unknown>;
      };

      const payloadConds = binding.conditions.filter(isPayloadCondition);
      if (payloadConds.length > 0) {
        if (!evaluatePayloadConditions(payloadConds, payload)) return;
      }

      const stateConds = binding.conditions.filter((c) => !isPayloadCondition(c));
      if (stateConds.length > 0 && payload.after) {
        if (!evaluateConditionsInMemory(stateConds, payload.after)) return;
      }
    }

    // Find the action that created the linked entities
    const action = rule.actions.find((a) => a.link?.as === binding.linked);
    if (!action) {
      this.logger.warn(`No action with link "${binding.linked}" in rule ${rule.id}`);
      return;
    }

    const handler = this.actionRegistry.get(action.type);
    if (!handler?.update) {
      this.logger.warn(`Action "${action.type}" does not support update for lifecycle binding`);
      return;
    }

    // Find linked entities via provenance
    const linked = await this.provenanceService.findLinked({
      ruleId: rule.id,
      linkName: binding.linked,
      sourceEntityType: event.entityType,
      sourceEntityId: event.entityId,
    });

    if (linked.length === 0) return;

    // Build interpolation context
    const payload = event.payload as Record<string, unknown>;
    const context = {
      event: {
        eventName: event.eventName,
        entityType: event.entityType,
        entityId: event.entityId,
        actorId: event.actorId,
      },
      payload,
    };

    const interpolated = interpolateValues(binding.set, context);

    // Update each linked entity
    for (const entry of linked) {
      try {
        await handler.update(entry.targetEntityId, interpolated, {
          rule,
          actionIndex: entry.actionIndex,
          actionConfig: action,
          resolvedUsers: {},
        });

        this.logger.debug('Lifecycle update applied', {
          ruleId: rule.id,
          linkName: binding.linked,
          targetEntityId: entry.targetEntityId,
        });
      } catch (error) {
        this.logger.error(`Lifecycle update failed for target ${entry.targetEntityId}`, {
          ruleId: rule.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private async processDeleteBindings(rule: AutomationRule, event: DomainEvent): Promise<void> {
    if (!rule.onSourceDeleted) return;

    for (const binding of rule.onSourceDeleted) {
      await this.processDeleteBinding(rule, binding, event);
    }
  }

  private async processDeleteBinding(
    rule: AutomationRule,
    binding: LifecycleDeleteBinding,
    event: DomainEvent,
  ): Promise<void> {
    const action = rule.actions.find((a) => a.link?.as === binding.linked);
    if (!action) {
      this.logger.warn(`No action with link "${binding.linked}" in rule ${rule.id}`);
      return;
    }

    const handler = this.actionRegistry.get(action.type);

    const linked = await this.provenanceService.findLinked({
      ruleId: rule.id,
      linkName: binding.linked,
      sourceEntityType: event.entityType,
      sourceEntityId: event.entityId,
    });

    if (linked.length === 0) return;

    for (const entry of linked) {
      try {
        if (binding.action === 'delete') {
          if (!handler?.delete) {
            this.logger.warn(`Action "${action.type}" does not support delete for lifecycle binding`);
            continue;
          }
          await handler.delete(entry.targetEntityId, {
            rule,
            actionIndex: entry.actionIndex,
            actionConfig: action,
            resolvedUsers: {},
          });
        } else if (binding.action === 'update' && binding.set) {
          if (!handler?.update) {
            this.logger.warn(`Action "${action.type}" does not support update for lifecycle binding`);
            continue;
          }
          await handler.update(entry.targetEntityId, binding.set, {
            rule,
            actionIndex: entry.actionIndex,
            actionConfig: action,
            resolvedUsers: {},
          });
        }

        this.logger.debug('Lifecycle delete binding applied', {
          ruleId: rule.id,
          linkName: binding.linked,
          action: binding.action,
          targetEntityId: entry.targetEntityId,
        });
      } catch (error) {
        this.logger.error(`Lifecycle delete binding failed for target ${entry.targetEntityId}`, {
          ruleId: rule.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Clean up provenance entries for this source
    await this.provenanceService.removeBySource(event.entityType, event.entityId);
  }
}
