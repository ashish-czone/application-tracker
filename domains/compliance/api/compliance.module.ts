import { Module, type OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AuditRegistryService } from '@packages/audit';
import { ActionRegistry } from '@packages/automation-contracts';
import { RbacIntegrationModule } from '@packages/rbac';

import { registerComplianceAudit } from './audit/register-compliance-audit';

import { LawsModule } from './laws';
import { ClientsModule } from './clients';
import { ClientContactsModule } from './client-contacts/client-contacts.module';
import { ClientRegistrationsModule } from './client-registrations';
import { ComplianceRulesModule } from './rules';
import { LawHandlersModule } from './law-handlers';
import { ComplianceFilingsModule } from './compliance-filings';
import { OrganizationsModule } from './organizations';

import { GenerateComplianceFilingsAction } from './automations/generate-compliance-filings.action';
import { SendComplianceFilingDigestAction } from './automations/send-compliance-filing-digest.action';
import { ComplianceFilingsGeneratorService } from './automations/compliance-filings-generator.service';
import { ComplianceFilingsGeneratorListener } from './automations/compliance-filings-generator.listener';
import { COMPLIANCE_PERMISSION_MANIFESTS } from './permissions';

@Module({
  imports: [
    LawsModule,
    ClientsModule,
    ClientContactsModule,
    ClientRegistrationsModule,
    ComplianceRulesModule,
    LawHandlersModule,
    ComplianceFilingsModule,
    OrganizationsModule,
    // Permissions for compliance UI surfaces that don't yet have backing
    // entities. CRUD perms for entities (clients, laws, etc.) are auto-
    // registered by EntityEngineModule.forEntity() inside each entity's module.
    RbacIntegrationModule.forFeature({ manifests: COMPLIANCE_PERMISSION_MANIFESTS }),
  ],
  providers: [
    ComplianceFilingsGeneratorService,
    ComplianceFilingsGeneratorListener,
    GenerateComplianceFilingsAction,
    SendComplianceFilingDigestAction,
  ],
})
export class ComplianceDomainModule implements OnModuleInit {
  constructor(
    private readonly actionRegistry: ActionRegistry,
    private readonly generateFilingsAction: GenerateComplianceFilingsAction,
    private readonly sendDigestAction: SendComplianceFilingDigestAction,
    private readonly auditRegistry: AuditRegistryService,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit() {
    this.actionRegistry.register(this.generateFilingsAction);
    this.actionRegistry.register(this.sendDigestAction);

    registerComplianceAudit(this.auditRegistry, this.moduleRef);
  }
}
