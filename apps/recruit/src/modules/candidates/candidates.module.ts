import { Module, type OnModuleInit } from '@nestjs/common';
import { RbacService } from '@packages/rbac';
import { EventRegistryService } from '@packages/events';
import { EntityResolverRegistry } from '@packages/notifications';
import { AuditRegistryService } from '@packages/audit';
import { LookupResolverService } from '@packages/eav-attributes';
import { CandidatesController } from './controllers/candidates.controller';
import { CandidatesService } from './services/candidates.service';
import { CandidatesSeedService } from './services/candidates-seed.service';
import { candidates } from './schema/candidates';
import {
  CANDIDATES_CANDIDATE_CREATED,
  CANDIDATES_CANDIDATE_UPDATED,
  CANDIDATES_CANDIDATE_DELETED,
} from './events/types';

@Module({
  controllers: [CandidatesController],
  providers: [CandidatesService, CandidatesSeedService],
  exports: [CandidatesService],
})
export class CandidatesModule implements OnModuleInit {
  constructor(
    private readonly eventRegistry: EventRegistryService,
    private readonly rbacService: RbacService,
    private readonly entityResolverRegistry: EntityResolverRegistry,
    private readonly auditRegistry: AuditRegistryService,
    private readonly lookupResolverService: LookupResolverService,
  ) {}

  async onModuleInit() {
    // 1. RBAC — register permissions
    this.rbacService.registerPermissions('candidates', [
      { action: 'create', description: 'Create candidates' },
      { action: 'read', description: 'View candidates' },
      { action: 'update', description: 'Update candidates' },
      { action: 'delete', description: 'Delete candidates' },
    ]);

    // 2. Events — register event metadata for notification rules UI
    this.eventRegistry.register({
      eventName: CANDIDATES_CANDIDATE_CREATED,
      group: 'candidates',
      description: 'Fired when a new candidate is created',
      payloadSchema: {
        firstName: { type: 'string', label: 'First Name' },
        lastName: { type: 'string', label: 'Last Name' },
        email: { type: 'string', label: 'Email' },
        source: { type: 'string', label: 'Source' },
      },
    });

    this.eventRegistry.register({
      eventName: CANDIDATES_CANDIDATE_UPDATED,
      group: 'candidates',
      description: 'Fired when a candidate is updated',
      payloadSchema: {
        changes: { type: 'string', label: 'Changed Fields' },
      },
    });

    this.eventRegistry.register({
      eventName: CANDIDATES_CANDIDATE_DELETED,
      group: 'candidates',
      description: 'Fired when a candidate is deleted',
      payloadSchema: {
        firstName: { type: 'string', label: 'First Name' },
        lastName: { type: 'string', label: 'Last Name' },
        email: { type: 'string', label: 'Email' },
      },
    });

    // 3. Audit — register which events to log
    this.auditRegistry.register('candidates', {
      events: [
        CANDIDATES_CANDIDATE_CREATED,
        CANDIDATES_CANDIDATE_UPDATED,
        CANDIDATES_CANDIDATE_DELETED,
      ],
    });

    // 4. Entity resolver — recipientFields only; field metadata comes from EAV
    //    (ConditionBuilder falls back to GET /entities/candidates/fields which
    //    returns all base + custom fields dynamically from field definitions)
    this.entityResolverRegistry.register('candidates', {
      table: candidates,
      fields: {},
      recipientFields: {
        createdBy: { label: 'Created By (recruiter)' },
      },
    });

    // 5. Lookup — register candidates as a lookup target
    this.lookupResolverService.register({
      entity: 'candidates',
      table: candidates,
      labelField: 'firstName',
      valueField: 'id',
      searchFields: ['firstName', 'lastName', 'email'],
    });
  }
}
