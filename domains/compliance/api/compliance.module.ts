import { Module, type OnModuleInit } from '@nestjs/common';
import { AuditRegistryService } from '@packages/audit';
import { ActionRegistry } from '@packages/automation-contracts';
import { RbacIntegrationModule } from '@packages/rbac';

import { registerComplianceAudit, type ComplianceEntityReader } from './audit/register-compliance-audit';

import { LawsModule, LawsService } from './laws';
import { ClientsModule, ClientsService } from './clients';
import { ClientContactsModule } from './client-contacts/client-contacts.module';
import { ClientContactsService } from './client-contacts/client-contacts.service';
import { ClientRegistrationsModule, ClientRegistrationsService } from './client-registrations';
import { ComplianceRulesModule, ComplianceRulesService } from './rules';
import { LawHandlersModule, LawHandlersService } from './law-handlers';
import { ComplianceFilingsModule, ComplianceFilingsService } from './compliance-filings';
import { OrganizationsModule } from './organizations';
import { OrganizationsService } from './organizations/organizations.service';

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
    // entities. CRUD perms for entities (clients, laws, etc.) are
    // registered by `RbacIntegrationModule.forFeature` inside each
    // entity's module.
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
    private readonly lawsService: LawsService,
    private readonly clientsService: ClientsService,
    private readonly clientContactsService: ClientContactsService,
    private readonly clientRegistrationsService: ClientRegistrationsService,
    private readonly rulesService: ComplianceRulesService,
    private readonly lawHandlersService: LawHandlersService,
    private readonly filingsService: ComplianceFilingsService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  onModuleInit() {
    this.actionRegistry.register(this.generateFilingsAction);
    this.actionRegistry.register(this.sendDigestAction);

    // Build the slug → scope-aware reader map the audit registration uses
    // to gate per-entity audit-log reads. Each entity's findOne / findOneOrFail
    // already applies the caller's `accessCtx`, so the audit row is visible
    // only when the underlying entity is.
    const readers = new Map<string, ComplianceEntityReader>([
      ['laws', (id, ctx) => this.lawsService.findOne(id, ctx)],
      ['clients', (id, ctx) => this.clientsService.findOne(id, ctx)],
      ['client-contacts', (id, ctx) => this.clientContactsService.findOneOrFail(id, ctx)],
      ['client-registrations', (id, ctx) => this.clientRegistrationsService.findOne(id, ctx)],
      ['compliance-rules', (id, ctx) => this.rulesService.findOne(id, ctx)],
      ['law-handlers', (id, ctx) => this.lawHandlersService.findOne(id, ctx)],
      ['compliance-filings', (id, ctx) => this.filingsService.findOne(id, ctx)],
      ['organizations', (id, ctx) => this.organizationsService.findOneOrFail(id, ctx)],
    ]);

    registerComplianceAudit(this.auditRegistry, readers);
  }
}
