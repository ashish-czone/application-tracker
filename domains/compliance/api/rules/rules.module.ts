import { forwardRef, Module, type OnModuleInit } from '@nestjs/common';
import {
  LookupResolverService,
  registerEntityLookup,
} from '@packages/entity-engine';
import { WorkflowsModule } from '@packages/workflows';
import { RbacIntegrationModule } from '@packages/rbac';
import { createCrudProvider } from '@packages/crud-base';
import { LawHandlersModule } from '../law-handlers';
import { ComplianceFilingsModule } from '../compliance-filings';
import { RULES_WORKFLOW } from './rules.workflow';
import { RULES_PERMISSION_MANIFESTS } from './rules.permissions';
import { ComplianceRulesController } from './rules.controller';
import { ComplianceRulesService } from './rules.service';
import { RULES_CRUD_TOKEN } from './rules.crud-token';
import { complianceRules } from './rules.schema';

/**
 * Rules module — fully de-engined. No more `EntityEngineModule.forEntity`:
 * the auto-CRUD path was already off (every CRUD method delegates to
 * `BaseCrudService` via `createCrudProvider`), and the workflow
 * orchestration path now goes directly through `WorkflowEngineService` +
 * `WorkflowRegistryService` from the consumer service.
 *
 * Lookup registration (so other entities can resolve `lawId` / `ruleId`
 * lookups against rule rows) was the only remaining reason `forEntity`
 * was load-bearing — we now register directly with `LookupResolverService`
 * in `onModuleInit`, no `defineEntity` config needed.
 */
@Module({
  imports: [
    WorkflowsModule.forFeature(RULES_WORKFLOW),
    RbacIntegrationModule.forFeature({ manifests: RULES_PERMISSION_MANIFESTS }),
    forwardRef(() => LawHandlersModule),
    ComplianceFilingsModule,
  ],
  controllers: [ComplianceRulesController],
  providers: [
    // No `scope:` block — `compliance_rules` carries no anchor columns
    // (`createdBy` / `assigneeId` / `teamId` etc.). Wiring forward-compat
    // scope here would have nothing to bind to. Every existing role grant
    // uses `'any'` scope on `compliance-rules.read`, so the predicate path
    // is moot today. If product later wants e.g. "rules I authored" reads,
    // that requires (a) a schema migration adding `created_by`, (b) a
    // `<entity>.scope.ts` declaring it as the `creator` anchor, (c)
    // wiring `scope:` here.
    createCrudProvider(RULES_CRUD_TOKEN, complianceRules, {
      slug: 'compliance-rules',
      events: {
        created: 'compliance-rules.Created',
        updated: 'compliance-rules.Updated',
        deleted: 'compliance-rules.Deleted',
      },
    }),
    ComplianceRulesService,
  ],
  exports: [ComplianceRulesService],
})
export class ComplianceRulesModule implements OnModuleInit {
  constructor(private readonly lookupResolver: LookupResolverService) {}

  onModuleInit(): void {
    registerEntityLookup(this.lookupResolver, {
      entityType: 'compliance-rules',
      table: complianceRules,
      labelField: 'name',
      searchFields: ['code', 'name'],
    });
  }
}
