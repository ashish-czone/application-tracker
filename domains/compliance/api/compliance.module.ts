import { Module, type OnModuleInit } from '@nestjs/common';
import { DatabaseService, type DrizzleDB } from '@packages/database';
import { EntityEngineModule } from '@packages/entity-engine';
import { ActionRegistry } from '@packages/automation-contracts';
import { RbacService } from '@packages/rbac';
import { TASKS_CONFIG, TasksModule } from '@packages/tasks';
import { USERS_POSITIONS_READER } from '@packages/users';
import { WorkflowGuardRegistry } from '@packages/workflows';

import { ComplianceUsersPositionsReader } from './users/compliance-users-positions.reader';

import { LAWS_CONFIG } from './laws/laws.config';
import { CLIENTS_CONFIG } from './clients/clients.config';
import { CLIENT_CONTACTS_CONFIG } from './client-contacts/client-contacts.config';
import { CLIENT_REGISTRATIONS_CONFIG } from './client-registrations/client-registrations.config';
import { COMPLIANCE_RULES_CONFIG } from './rules/rules.config';
import { LAW_HANDLERS_CONFIG } from './law-handlers/law-handlers.config';
import { COMPLIANCE_TASKS_CONFIG } from './compliance-tasks/compliance-tasks.config';
import { createOrganizationsEntityConfig } from './organizations/organizations.config';

import { LawHandlerService } from './law-handlers/law-handlers.service';
import { ClientRegistrationService } from './client-registrations/client-registrations.service';
import { ClientsService } from './clients/clients.service';
import { ClientContactsService } from './client-contacts/client-contacts.service';
import { ClientsController } from './clients/clients.controller';
import { ComplianceRuleService } from './rules/compliance-rules.service';
import { ComplianceTasksLookupService } from './compliance-tasks/compliance-tasks-lookup.service';
import { GenerateComplianceTasksAction } from './automations/generate-compliance-tasks.action';
import { COMPLIANCE_PERMISSION_REGISTRATIONS } from './permissions';

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
    EntityEngineModule.forEntity(LAWS_CONFIG),
    EntityEngineModule.forEntity(CLIENTS_CONFIG),
    EntityEngineModule.forEntity(CLIENT_CONTACTS_CONFIG),
    EntityEngineModule.forEntity(CLIENT_REGISTRATIONS_CONFIG),
    EntityEngineModule.forEntity(COMPLIANCE_RULES_CONFIG),
    EntityEngineModule.forEntity(LAW_HANDLERS_CONFIG),
    EntityEngineModule.forEntity(COMPLIANCE_TASKS_CONFIG),
    EntityEngineModule.forEntity(ORGANIZATIONS_CONFIG),
  ],
  controllers: [ClientsController],
  providers: [
    LawHandlerService,
    ClientRegistrationService,
    ClientsService,
    ClientContactsService,
    ComplianceRuleService,
    ComplianceTasksLookupService,
    GenerateComplianceTasksAction,
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
    private readonly generateTasksAction: GenerateComplianceTasksAction,
    private readonly guardRegistry: WorkflowGuardRegistry,
    private readonly contactsService: ClientContactsService,
    private readonly rbac: RbacService,
    private readonly databaseService: DatabaseService,
  ) {}

  onModuleInit() {
    organizationsDbRef = this.databaseService.db;

    this.actionRegistry.register(this.generateTasksAction);

    // Blocks onboarding → active on the clients workflow unless the client
    // has at least one primary contact. Referenced by `guardNames` on the
    // transition in clients.config.ts.
    this.guardRegistry.register('require-primary-contact', async (ctx) => {
      if (ctx.entityType !== 'clients') return true;
      return this.contactsService.hasPrimaryContact(ctx.entityId);
    });

    // Register permissions for compliance UI surfaces that don't yet have
    // backing entities. CRUD perms for entities (clients, laws, etc.) are
    // auto-registered by EntityEngineModule.forEntity() above.
    const byModule = new Map<string, { action: string; description: string }[]>();
    for (const { module, action, description } of COMPLIANCE_PERMISSION_REGISTRATIONS) {
      const list = byModule.get(module) ?? [];
      list.push({ action, description });
      byModule.set(module, list);
    }
    for (const [module, perms] of byModule) {
      this.rbac.registerPermissions(module, perms);
    }
  }
}
