import { Module, type OnModuleInit } from '@nestjs/common';
import { RbacService } from '@packages/rbac';
import { EventRegistryService } from '@packages/events';
import { EntityResolverRegistry } from '@packages/notifications';
import { AuditRegistryService } from '@packages/audit';
import { FieldDefinitionService, LayoutService, LookupResolverService } from '@packages/eav-attributes';
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
    private readonly fieldDefinitionService: FieldDefinitionService,
    private readonly layoutService: LayoutService,
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

    // 5. EAV — register standard fields (idempotent)
    await this.fieldDefinitionService.registerStandardFields('candidates', [
      { fieldKey: 'first_name', label: 'First Name', fieldType: 'text', columnName: 'first_name', isSystem: true, isRequired: true, isQuickCreate: true, maxLength: 100 },
      { fieldKey: 'last_name', label: 'Last Name', fieldType: 'text', columnName: 'last_name', isSystem: true, isRequired: true, isQuickCreate: true, maxLength: 100 },
      { fieldKey: 'email', label: 'Email', fieldType: 'email', columnName: 'email', isUnique: true, isQuickCreate: true, maxLength: 255 },
      { fieldKey: 'phone', label: 'Phone', fieldType: 'phone', columnName: 'phone', isQuickCreate: true, maxLength: 20 },
      { fieldKey: 'source', label: 'Source', fieldType: 'picklist', columnName: 'source', isQuickCreate: true },
      { fieldKey: 'current_company', label: 'Current Company', fieldType: 'text', columnName: 'current_company', maxLength: 200 },
      { fieldKey: 'current_title', label: 'Current Title', fieldType: 'text', columnName: 'current_title', maxLength: 200 },
      { fieldKey: 'expected_salary', label: 'Expected Salary', fieldType: 'currency', columnName: 'expected_salary' },
      { fieldKey: 'currency', label: 'Currency', fieldType: 'text', columnName: 'currency', maxLength: 3 },
      { fieldKey: 'highest_qualification', label: 'Highest Qualification', fieldType: 'picklist', columnName: 'highest_qualification' },
      { fieldKey: 'date_of_birth', label: 'Date of Birth', fieldType: 'date', columnName: 'date_of_birth' },
      { fieldKey: 'gender', label: 'Gender', fieldType: 'picklist', columnName: 'gender' },
      { fieldKey: 'nationality', label: 'Nationality', fieldType: 'text', columnName: 'nationality', maxLength: 100 },
      { fieldKey: 'address', label: 'Street Address', fieldType: 'text', columnName: 'address', maxLength: 500 },
      { fieldKey: 'city', label: 'City', fieldType: 'text', columnName: 'city', maxLength: 100 },
      { fieldKey: 'state', label: 'State', fieldType: 'text', columnName: 'state', maxLength: 100 },
      { fieldKey: 'country', label: 'Country', fieldType: 'text', columnName: 'country', maxLength: 100 },
      { fieldKey: 'zip_code', label: 'Zip Code', fieldType: 'text', columnName: 'zip_code', maxLength: 20 },
      { fieldKey: 'is_willing_to_relocate', label: 'Willing to Relocate', fieldType: 'boolean', columnName: 'is_willing_to_relocate' },
      { fieldKey: 'available_from', label: 'Available From', fieldType: 'date', columnName: 'available_from' },
      { fieldKey: 'linkedin_url', label: 'LinkedIn URL', fieldType: 'url', columnName: 'linkedin_url', maxLength: 500 },
      { fieldKey: 'notes', label: 'Notes', fieldType: 'textarea', columnName: 'notes', maxLength: 5000 },
    ]);

    // 6. EAV — seed picklist options
    await this.fieldDefinitionService.setPicklistOptions('candidates', 'source', [
      { label: 'Referral', value: 'referral' },
      { label: 'Job Board', value: 'job-board' },
      { label: 'LinkedIn', value: 'linkedin' },
      { label: 'Direct', value: 'direct' },
      { label: 'Website', value: 'website' },
    ]);

    await this.fieldDefinitionService.setPicklistOptions('candidates', 'highest_qualification', [
      { label: 'High School', value: 'high-school' },
      { label: 'Bachelors', value: 'bachelors' },
      { label: 'Masters', value: 'masters' },
      { label: 'PhD', value: 'phd' },
      { label: 'Other', value: 'other' },
    ]);

    await this.fieldDefinitionService.setPicklistOptions('candidates', 'gender', [
      { label: 'Male', value: 'male' },
      { label: 'Female', value: 'female' },
      { label: 'Other', value: 'other' },
      { label: 'Prefer not to say', value: 'prefer-not-to-say' },
    ]);

    // 7. EAV — seed default layout
    await this.layoutService.seedDefaultLayout('candidates', [
      { name: 'Basic Info', fields: ['first_name', 'last_name', 'email', 'phone', 'gender', 'date_of_birth', 'nationality'] },
      { name: 'Professional Details', fields: ['current_title', 'current_company', 'expected_salary', 'source', 'available_from', 'is_willing_to_relocate', 'linkedin_url'] },
      { name: 'Education', fields: ['highest_qualification'] },
      { name: 'Address', fields: ['address', 'city', 'state', 'country', 'zip_code'] },
    ]);

    // 8. Lookup — register candidates as a lookup target
    this.lookupResolverService.register({
      entity: 'candidates',
      table: candidates,
      labelField: 'firstName',
      valueField: 'id',
      searchFields: ['firstName', 'lastName', 'email'],
    });
  }
}
