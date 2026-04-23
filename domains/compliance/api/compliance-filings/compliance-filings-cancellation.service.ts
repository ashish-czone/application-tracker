import { Injectable } from '@nestjs/common';
import { inArray } from '@packages/database';
import { WorkflowEngineService, WorkflowRegistryService } from '@packages/workflows';
import { complianceFilings } from '../schema/compliance-filings';

const FILING_WORKFLOW_SLUG = 'compliance-filing-status';

/**
 * Shared cascade: bulk-cancels a batch of compliance filings inside an
 * existing transaction and records a `workflow_transition_history` row per
 * filing. Callers (registration deactivation I4-I7, rule deprecation I8-I10,
 * future: client dormancy hardening) supply the reason/comment/actor — this
 * service owns only the mechanical cancel + history write so every cascade
 * path stays consistent in how it lands in the audit trail.
 */
@Injectable()
export class ComplianceFilingsCancellationService {
  constructor(
    private readonly workflowEngine: WorkflowEngineService,
    private readonly workflowRegistry: WorkflowRegistryService,
  ) {}

  async cancelFilings(
    tx: any,
    filings: Array<{ id: string; status: string }>,
    params: {
      reason: string;
      comment: string;
      actorId: string | null;
    },
  ): Promise<void> {
    if (filings.length === 0) return;

    const definition = this.workflowRegistry.getBySlug(FILING_WORKFLOW_SLUG);
    if (!definition) {
      throw new Error(
        `Workflow definition '${FILING_WORKFLOW_SLUG}' not found — cannot record filing cancellation history`,
      );
    }
    const transitionIdByFromState = new Map<string, string>();
    for (const t of definition.transitions) {
      if (t.toStateName === 'cancelled') {
        transitionIdByFromState.set(t.fromStateName, t.id);
      }
    }

    const ids = filings.map((f) => f.id);
    await tx
      .update(complianceFilings)
      .set({ status: 'cancelled' })
      .where(inArray(complianceFilings.id, ids));

    for (const filing of filings) {
      const transitionId = transitionIdByFromState.get(filing.status);
      if (!transitionId) {
        throw new Error(
          `No configured transition from '${filing.status}' → 'cancelled' on workflow '${FILING_WORKFLOW_SLUG}'. Filing ${filing.id} cannot be auto-cancelled; fix the workflow definition or exclude this state from the cascade.`,
        );
      }
      await this.workflowEngine.recordHistory(
        {
          workflowDefinitionId: definition.id,
          entityType: 'compliance-filings',
          entityId: filing.id,
          fieldName: 'status',
          fromState: filing.status,
          toState: 'cancelled',
          transitionId,
          actorId: params.actorId,
          reason: params.reason,
          comment: params.comment,
        },
        tx,
      );
    }
  }
}
