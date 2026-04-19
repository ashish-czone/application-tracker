import { Module, type OnModuleInit } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { ActionRegistry } from '@packages/automation-contracts';
import { RbacService } from '@packages/rbac';
import { TASKS_CONFIG, TasksModule } from '@packages/tasks';
import { WorkflowGuardRegistry } from '@packages/workflows';

import { LAWS_CONFIG } from './laws/laws.config';
import { CLIENTS_CONFIG } from './clients/clients.config';
import { CLIENT_CONTACTS_CONFIG } from './client-contacts/client-contacts.config';
import { CLIENT_REGISTRATIONS_CONFIG } from './client-registrations/client-registrations.config';
import { COMPLIANCE_RULES_CONFIG } from './rules/rules.config';
import { LAW_HANDLERS_CONFIG } from './law-handlers/law-handlers.config';

import { LawHandlerService } from './law-handlers/law-handlers.service';
import { ClientRegistrationService } from './client-registrations/client-registrations.service';
import { ClientsService } from './clients/clients.service';
import { ClientContactsService } from './client-contacts/client-contacts.service';
import { ClientsController } from './clients/clients.controller';
import { ComplianceRuleService } from './rules/compliance-rules.service';
import { ComplianceTasksService } from './compliance-tasks/compliance-tasks.service';
import { ComplianceTasksController } from './compliance-tasks/compliance-tasks.controller';
import { GenerateComplianceTasksAction } from './automations/generate-compliance-tasks.action';
import { COMPLIANCE_PERMISSION_REGISTRATIONS } from './permissions';

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
  ],
  controllers: [ClientsController, ComplianceTasksController],
  providers: [
    LawHandlerService,
    ClientRegistrationService,
    ClientsService,
    ClientContactsService,
    ComplianceRuleService,
    ComplianceTasksService,
    GenerateComplianceTasksAction,
  ],
})
export class ComplianceDomainModule implements OnModuleInit {
  constructor(
    private readonly actionRegistry: ActionRegistry,
    private readonly generateTasksAction: GenerateComplianceTasksAction,
    private readonly guardRegistry: WorkflowGuardRegistry,
    private readonly contactsService: ClientContactsService,
    private readonly rbac: RbacService,
  ) {}

  onModuleInit() {
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
