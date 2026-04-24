import { Module, type OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AuditRegistryService } from '@packages/audit';
import { ActionRegistry } from '@packages/automation-contracts';
import { RbacService } from '@packages/rbac';
import { TasksModule } from '@packages/tasks';
import { USERS_POSITIONS_READER } from '@packages/users';
import { WorkflowGuardRegistry, allow, allowWithWarning, block } from '@packages/workflows';
import { ClientDormancyService } from './clients/client-dormancy.service';

import { registerComplianceAudit } from './audit/register-compliance-audit';

import { ComplianceUsersPositionsReader } from './users/compliance-users-positions.reader';

import { LawsModule } from './laws/laws.module';
import { ClientsModule } from './clients/clients.module';
import { ClientContactsModule } from './client-contacts/client-contacts.module';
import { ClientRegistrationsModule } from './client-registrations/client-registrations.module';
import { ComplianceRulesModule } from './rules/compliance-rules.module';
import { LawHandlersModule } from './law-handlers/law-handlers.module';
// compliance-tasks/ is the pre-filings implementation — retained for reference
// while the filings migration is in-flight. New work goes to compliance-filings/.
import { ComplianceFilingsModule } from './compliance-filings/compliance-filings.module';
import { OrganizationsModule } from './organizations/organizations.module';

import { ClientContactsService } from './client-contacts/client-contacts.service';
import { GenerateComplianceFilingsAction } from './automations/generate-compliance-filings.action';
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
    GenerateComplianceFilingsAction,
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
    private readonly guardRegistry: WorkflowGuardRegistry,
    private readonly contactsService: ClientContactsService,
    private readonly clientDormancyService: ClientDormancyService,
    private readonly rbac: RbacService,
    private readonly auditRegistry: AuditRegistryService,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit() {
    this.actionRegistry.register(this.generateFilingsAction);

    registerComplianceAudit(this.auditRegistry, this.moduleRef);

    // Blocks onboarding → active on the clients workflow unless the client
    // has at least one primary contact. Referenced by `guardNames` on the
    // transition in clients.config.ts.
    this.guardRegistry.register('require-primary-contact', async (ctx) => {
      if (ctx.entityType !== 'clients') return allow();
      const hasPrimary = await this.contactsService.hasPrimaryContact(ctx.entityId);
      return hasPrimary
        ? allow()
        : block('Add a primary contact before activating this client.');
    });

    // Advisory guard on clients active → dormant: surfaces the count of
    // non-terminal filings that will be auto-cancelled, so the admin
    // confirms knowingly. Cascade itself runs in ClientsService.transition
    // inside its own tx via ClientDormancyService — this guard is
    // preflight-only.
    this.guardRegistry.register('compliance-client-dormancy-warning', async (ctx) => {
      if (ctx.entityType !== 'clients') return allow();
      if (ctx.toState !== 'dormant') return allow();
      const count = await this.clientDormancyService.countNonTerminalFilings(ctx.entityId);
      if (count === 0) return allow();
      const noun = count === 1 ? 'filing' : 'filings';
      return allowWithWarning(
        `${count} non-terminal ${noun} will be cancelled when this client is dormantised.`,
      );
    });

    // Register permissions for compliance UI surfaces that don't yet have
    // backing entities. CRUD perms for entities (clients, laws, etc.) are
    // auto-registered by EntityEngineModule.forEntity() inside each entity's module.
    this.rbac.registerManifests(COMPLIANCE_PERMISSION_MANIFESTS);
  }
}
