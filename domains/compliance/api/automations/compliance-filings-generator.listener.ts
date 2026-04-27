import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { DomainEvent } from '@packages/events';
import { AppLoggerService, type ContextLogger } from '@packages/logger';

import { ComplianceFilingsGeneratorService } from './compliance-filings-generator.service';

/**
 * Stream J event-triggered top-ups (J3 / J4 / J5). The generator's daily
 * cron is a safety net — these listeners keep the filing horizon current
 * the moment the source state changes, so a user who just activated a rule
 * or registered a new client doesn't have to wait for the 2am cron tick to
 * see filings in their queue.
 *
 * All three paths route through {@link ComplianceFilingsGeneratorService},
 * which is idempotent (per-occurrence findByRuleClientPeriod) — overlap
 * with the cron is safe.
 */
@Injectable()
export class ComplianceFilingsGeneratorListener {
  private readonly logger: ContextLogger;

  constructor(
    private readonly generator: ComplianceFilingsGeneratorService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(ComplianceFilingsGeneratorListener.name);
  }

  /**
   * Catch-all dispatcher. Wildcard `**` is the codebase convention for
   * domain event listeners — a single subscription dispatches by event name
   * inside the handler. Keeps EventEmitter2 routing trivial and lets us
   * filter on payload shape without paying for namespace gymnastics.
   */
  @OnEvent('**')
  async handle(event: DomainEvent): Promise<void> {
    try {
      switch (event.eventName) {
        case 'compliance-rules.Created':
          await this.handleRuleCreated(event);
          return;
        case 'compliance-rules.StatusChanged':
          await this.handleRuleStatusChanged(event);
          return;
        case 'client-registrations.Created':
          await this.handleRegistrationCreated(event);
          return;
        case 'clients.StatusChanged':
          await this.handleClientStatusChanged(event);
          return;
        default:
          return;
      }
    } catch (error) {
      this.logger.error('Compliance filing top-up failed', {
        eventName: event.eventName,
        entityId: event.entityId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ---------------------------------------------------------------------------
  // J3 — rule activation. The rule's `status` field is workflow-bound, so a
  // transition fires StatusChanged. A rule created already in `active` (rare,
  // but possible via direct admin) still needs a top-up — so the Created event
  // is also covered.
  // ---------------------------------------------------------------------------

  private async handleRuleCreated(event: DomainEvent): Promise<void> {
    const after = (event.payload as { after?: { status?: string } } | undefined)?.after;
    if (after?.status !== 'active') return;
    await this.generator.generateForRule(event.entityId);
  }

  private async handleRuleStatusChanged(event: DomainEvent): Promise<void> {
    const payload = event.payload as
      | { fromState?: string; toState?: string }
      | undefined;
    if (payload?.toState !== 'active') return;
    if (payload?.fromState === 'active') return;
    await this.generator.generateForRule(event.entityId);
  }

  // ---------------------------------------------------------------------------
  // J4 — new registration. Registrations have no workflow; create event payload
  // carries the full snapshot under `after`.
  // ---------------------------------------------------------------------------

  private async handleRegistrationCreated(event: DomainEvent): Promise<void> {
    const after = (event.payload as { after?: { clientId?: string; lawId?: string } } | undefined)?.after;
    const clientId = after?.clientId;
    const lawId = after?.lawId;
    if (!clientId || !lawId) {
      this.logger.warn('client-registrations.Created event missing clientId or lawId on after snapshot', {
        entityId: event.entityId,
      });
      return;
    }
    await this.generator.generateForRegistration(clientId, lawId);
  }

  // ---------------------------------------------------------------------------
  // J5 — client reactivation. `clients.status` is workflow-bound; a flip back
  // to `active` from `dormant` (or onboarding) re-arms generation. Q6 keeps
  // already-cancelled dormancy filings cancelled — the per-occurrence
  // idempotency guard does not regenerate them.
  // ---------------------------------------------------------------------------

  private async handleClientStatusChanged(event: DomainEvent): Promise<void> {
    const payload = event.payload as
      | { fromState?: string; toState?: string }
      | undefined;
    if (payload?.toState !== 'active') return;
    if (payload?.fromState === 'active') return;
    await this.generator.generateForClient(event.entityId);
  }
}
