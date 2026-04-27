import { Module, type OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AuditRegistryService } from '@packages/audit';
import { ActionRegistry } from '@packages/automation-contracts';
import { RbacService } from '@packages/rbac';
import { TasksModule } from '@packages/tasks';
import { USERS_POSITIONS_READER } from '@packages/users';

import { registerComplianceAudit } from './audit/register-compliance-audit';

import { ComplianceUsersPositionsReader } from './users/compliance-users-positions.reader';

import { LawsModule } from './laws/laws.module';
import { ClientsModule } from './clients/clients.module';
import { ClientContactsModule } from './client-contacts/client-contacts.module';
import { ClientRegistrationsModule } from './client-registrations/client-registrations.module';
import { ComplianceRulesModule } from './rules/compliance-rules.module';
import { LawHandlersModule } from './law-handlers/law-handlers.module';
import { ComplianceFilingsModule } from './compliance-filings/compliance-filings.module';
import { OrganizationsModule } from './organizations/organizations.module';

import { GenerateComplianceFilingsAction } from './automations/generate-compliance-filings.action';
import { SendComplianceFilingDigestAction } from './automations/send-compliance-filing-digest.action';
import { ComplianceFilingsGeneratorService } from './automations/compliance-filings-generator.service';
import { ComplianceFilingsGeneratorListener } from './automations/compliance-filings-generator.listener';
import { COMPLIANCE_PERMISSION_MANIFESTS } from './permissions';

@Module({
  imports: [
    TasksModule,
    LawsModule,
    ClientsModule,
    ClientContactsModule,
    ClientRegistrationsModule,
    ComplianceRulesModule,
    LawHandlersModule,
    ComplianceFilingsModule,
    OrganizationsModule,
  ],
  providers: [
    ComplianceFilingsGeneratorService,
    ComplianceFilingsGeneratorListener,
    GenerateComplianceFilingsAction,
    SendComplianceFilingDigestAction,
    ComplianceUsersPositionsReader,
    {
      provide: USERS_POSITIONS_READER,
      useExisting: ComplianceUsersPositionsReader,
    },
  ],
})
export class ComplianceDomainModule implements OnModuleInit {
  constructor(
    private readonly actionRegistry: ActionRegistry,
    private readonly generateFilingsAction: GenerateComplianceFilingsAction,
    private readonly sendDigestAction: SendComplianceFilingDigestAction,
    private readonly rbac: RbacService,
    private readonly auditRegistry: AuditRegistryService,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit() {
    this.actionRegistry.register(this.generateFilingsAction);
    this.actionRegistry.register(this.sendDigestAction);

    registerComplianceAudit(this.auditRegistry, this.moduleRef);

    // Register permissions for compliance UI surfaces that don't yet have
    // backing entities. CRUD perms for entities (clients, laws, etc.) are
    // auto-registered by EntityEngineModule.forEntity() inside each entity's module.
    this.rbac.registerManifests(COMPLIANCE_PERMISSION_MANIFESTS);
  }
}
