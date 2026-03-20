import { Module, type OnModuleInit } from '@nestjs/common';
import { RbacService } from '@packages/rbac';
import { EventRegistryService } from '@packages/events';
import { EntityResolverRegistry } from '@packages/notifications';
import { AuditRegistryService } from '@packages/audit';
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
  ) {}

  onModuleInit() {
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

    // 4. Entity resolver — for notification rules to reference candidate fields
    this.entityResolverRegistry.register('candidates', {
      table: candidates,
      fields: {
        source: {
          type: 'enum',
          label: 'Source',
          options: ['referral', 'job-board', 'website', 'direct', 'linkedin'],
        },
        country: { type: 'text', label: 'Country' },
        highestQualification: {
          type: 'enum',
          label: 'Qualification',
          options: ['high-school', 'bachelors', 'masters', 'phd', 'other'],
        },
      },
      recipientFields: {
        createdBy: { label: 'Created By (recruiter)' },
      },
    });
  }
}
