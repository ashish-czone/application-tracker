import { Module } from '@nestjs/common';
import { EntityEngineModule } from '@packages/entity-engine';

import { LAWS_CONFIG } from './laws/laws.config';
import { CLIENTS_CONFIG } from './clients/clients.config';
import { COMPLIANCE_RULES_CONFIG } from './rules/rules.config';
import { LAW_HANDLERS_CONFIG } from './law-handlers/law-handlers.config';

@Module({
  imports: [
    EntityEngineModule.forEntity(LAWS_CONFIG),
    EntityEngineModule.forEntity(CLIENTS_CONFIG),
    EntityEngineModule.forEntity(COMPLIANCE_RULES_CONFIG),
    EntityEngineModule.forEntity(LAW_HANDLERS_CONFIG),
  ],
})
export class ComplianceDomainModule {}
