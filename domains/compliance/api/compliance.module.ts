import { Module, type OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AuditRegistryService } from '@packages/audit';
import { DatabaseService, type DrizzleDB } from '@packages/database';
import { EntityEngineModule } from '@packages/entity-engine';
import { ActionRegistry } from '@packages/automation-contracts';
import { RbacService } from '@packages/rbac';
import { TASKS_CONFIG, TasksModule } from '@packages/tasks';
import { USERS_POSITIONS_READER } from '@packages/users';
import { WorkflowGuardRegistry, allow, allowWithWarning, block } from '@packages/workflows';
import { ClientDormancyService } from './clients/client-dormancy.service';

import { registerComplianceAudit } from './audit/register-compliance-audit';

import { ComplianceUsersPositionsReader } from './users/compliance-users-positions.reader';

import { LawsModule } from './laws/laws.module';
import { CLIENTS_CONFIG, setClientDormancyHandler } from './clients/clients.config';
import { ClientContactsModule } from './client-contacts/client-contacts.module';
import { ClientRegistrationsModule } from './client-registrations/client-registrations.module';
import { ComplianceRulesModule } from './rules/compliance-rules.module';
import { LawHandlersModule } from './law-handlers/law-handlers.module';
// compliance-tasks/ is the pre-filings implementation — retained for reference
// while the filings migration is in-flight. New work goes to compliance-filings/.
import { ComplianceFilingsModule } from './compliance-filings/compliance-filings.module';
import { createOrganizationsEntityConfig } from './organizations/organizations.config';

import { ClientsService } from './clients/clients.service';
import { ClientContactsService } from './client-contacts/client-contacts.service';
import { ClientsController } from './clients/clients.controller';
import { GenerateComplianceFilingsAction } from './automations/generate-compliance-filings.action';
import { COMPLIANCE_PERMISSION_MANIFESTS } from './permissions';

// Late-bound database handle: the organizations config references this via a
// getter so singleton enforcement can query the DB at request time without
// needing the live client at module-definition time. Populated in onModuleInit.
let organizationsDbRef: DrizzleDB | null = null;
const ORGANIZATIONS_CONFIG = createOrganizationsEntityConfig({
  getDb: () => {
    if (!organizationsDbRef) {
      throw new Error('Organizations config accessed before module init — db not yet wired.');
    }
    return organizationsDbRef;
  },
});

@Module({
  imports: [
    TasksModule,
    EntityEngineModule.forEntity(TASKS_CONFIG),
    LawsModule,
    EntityEngineModule.forEntity(CLIENTS_CONFIG),
    ClientContactsModule,
    ClientRegistrationsModule,
    ComplianceRulesModule,
    LawHandlersModule,
    ComplianceFilingsModule,
    EntityEngineModule.forEntity(ORGANIZATIONS_CONFIG),
  ],
  controllers: [ClientsController],
  providers: [
    ClientsService,
    GenerateComplianceFilingsAction,
    ClientDormancyService,
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
    private readonly databaseService: DatabaseService,
    private readonly auditRegistry: AuditRegistryService,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit() {
    organizationsDbRef = this.databaseService.db;

    this.actionRegistry.register(this.generateFilingsAction);

    // Wire the CLIENTS onTransition hook to the dormancy service. The hook
    // runs inside the client transition tx and receives the same tx handle
    // so filing cancellation commits atomically with the status flip.
    setClientDormancyHandler(this.clientDormancyService);

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
    // confirms knowingly. Cascade itself runs in ClientDormancyService via
    // the onTransition hook — this guard is preflight-only.
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
    // auto-registered by EntityEngineModule.forEntity() above.
    this.rbac.registerManifests(COMPLIANCE_PERMISSION_MANIFESTS);
  }
}
