import { Injectable } from '@nestjs/common';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import type {
  ActionHandler,
  ActionContext,
  ActionResult,
  UserSlotDefinition,
} from '@packages/automation-contracts';

import { ComplianceFilingsGeneratorService } from './compliance-filings-generator.service';

/**
 * Pull-side adapter. The automation framework (schedule scanner + ad-hoc rule
 * runs) invokes this action with a rule id; iteration logic lives in
 * {@link ComplianceFilingsGeneratorService} so the J3-J5 event listeners can
 * share it without going through ActionContext.
 */
@Injectable()
export class GenerateComplianceFilingsAction implements ActionHandler {
  readonly type = 'generate_compliance_filings';
  readonly label = 'Generate Compliance Filings';
  readonly userSlots: UserSlotDefinition[] = [];
  readonly configSchema = {};

  private readonly logger: ContextLogger;

  constructor(
    private readonly generator: ComplianceFilingsGeneratorService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(GenerateComplianceFilingsAction.name);
  }

  async execute(context: ActionContext): Promise<ActionResult> {
    const ruleId = context.event?.entityId ?? context.entityId;
    if (!ruleId) {
      this.logger.warn('No rule id in action context — skipping');
      return {};
    }
    await this.generator.generateForRule(ruleId);
    return {};
  }
}
