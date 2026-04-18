import { Module, type OnModuleInit } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';
import { ActionRegistry } from '@packages/automation-contracts';
import { TasksModule } from '@packages/tasks';

import { LAWS_CONFIG } from './laws/laws.config';
import { CLIENTS_CONFIG } from './clients/clients.config';
import { CLIENT_CONTACTS_CONFIG } from './client-contacts/client-contacts.config';
import { COMPLIANCE_RULES_CONFIG } from './rules/rules.config';
import { LAW_HANDLERS_CONFIG } from './law-handlers/law-handlers.config';

import { LawHandlerService } from './law-handlers/law-handlers.service';
import { ClientRegistrationService } from './client-registrations/client-registrations.service';
import { ClientsService } from './clients/clients.service';
import { ClientContactsService } from './client-contacts/client-contacts.service';
import { ComplianceRuleService } from './rules/compliance-rules.service';
import { GenerateComplianceTasksAction } from './automations/generate-compliance-tasks.action';

@Module({
  imports: [
    TasksModule,
    EntityEngineModule.forEntity(LAWS_CONFIG),
    EntityEngineModule.forEntity(CLIENTS_CONFIG),
    EntityEngineModule.forEntity(CLIENT_CONTACTS_CONFIG),
    EntityEngineModule.forEntity(COMPLIANCE_RULES_CONFIG),
    EntityEngineModule.forEntity(LAW_HANDLERS_CONFIG),
  ],
  providers: [
    LawHandlerService,
    ClientRegistrationService,
    ClientsService,
    ClientContactsService,
    ComplianceRuleService,
    GenerateComplianceTasksAction,
  ],
})
export class ComplianceDomainModule implements OnModuleInit {
  constructor(
    private readonly actionRegistry: ActionRegistry,
    private readonly generateTasksAction: GenerateComplianceTasksAction,
  ) {}

  onModuleInit() {
    this.actionRegistry.register(this.generateTasksAction);
  }
}
