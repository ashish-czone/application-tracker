import { eq, ilike } from 'drizzle-orm';
import type { EntityConfig } from '@packages/entity-engine';
import { candidates } from './schema/candidates';
import { CANDIDATE_FIELD_META, CANDIDATE_SECTIONS } from './field-meta';

/**
 * EntityConfig for the Candidates entity.
 *
 * This is the single config object that drives all CRUD, routing,
 * RBAC, events, audit, field seeding, and layout for candidates.
 *
 * Domain-specific logic is handled via hooks.
 */
export const candidatesConfig: EntityConfig = {
  entityType: 'candidates',
  singularName: 'Candidate',
  pluralName: 'Candidates',
  slug: 'candidates',

  table: candidates,
  systemColumns: ['id', 'createdAt', 'updatedAt', 'deletedAt', 'deletedBy', 'createdBy', 'resumeFile'],

  searchColumns: [candidates.firstName, candidates.lastName, candidates.email],

  defaultSort: 'createdAt',
  sortableColumns: {
    firstName: candidates.firstName,
    email: candidates.email,
    createdAt: candidates.createdAt,
    country: candidates.country,
  },

  fieldMeta: CANDIDATE_FIELD_META,
  sections: CANDIDATE_SECTIONS,

  lookup: {
    labelField: 'firstName',
    searchFields: ['firstName', 'lastName', 'email'],
  },

  listFields: ['firstName', 'lastName', 'email', 'mobile', 'currentTitle', 'currentCompany', 'candidateStatus', 'source', 'applicationsCount'],

  relationships: [
    {
      name: 'applications',
      type: 'hasMany',
      targetEntity: 'applications',
      foreignKey: 'candidateId',
      label: 'Applications',
      displayFields: ['stage', 'createdAt'],
    },
  ],

  recipientFields: {
    createdBy: { label: 'Created By (recruiter)' },
  },

  actions: {
    row: [
      { key: 'edit', label: 'Edit', icon: 'Pencil', permission: 'update' },
      { key: 'clone', label: 'Clone', icon: 'Copy', permission: 'create' },
      { key: 'delete', label: 'Delete', icon: 'Trash2', permission: 'delete', variant: 'destructive' },
    ],
    bulk: [
      { key: 'massUpdate', label: 'Mass Update', icon: 'PenLine', permission: 'update' },
      { key: 'massDelete', label: 'Mass Delete', icon: 'Trash2', permission: 'delete', variant: 'destructive' },
      { key: 'export', label: 'Export', icon: 'Download', permission: 'read' },
    ],
    detail: [
      {
        key: 'apply-to-job',
        label: 'Apply to Job',
        icon: 'Briefcase',
        permission: 'create',
        picker: {
          entityType: 'job_openings',
          selectionMode: 'single',
          submitUrl: '/applications',
          fieldMapping: { candidateId: ':id', jobOpeningId: ':selectedId' },
          existingCheck: {
            listUrl: '/applications',
            filterField: 'candidateId',
            matchField: 'jobOpeningId',
            label: 'Already applied',
            disableSelection: true,
          },
        },
      },
      { key: 'clone', label: 'Clone', icon: 'Copy', permission: 'create' },
      { key: 'delete', label: 'Delete', icon: 'Trash2', permission: 'delete', variant: 'destructive' },
    ],
  },

  ui: {
    icon: 'users',
    nameField: ['firstName', 'lastName'],
    subtitleField: 'currentTitle',
    navGroup: 'recruit',
    navOrder: 1,
  },

  hooks: {
    // source, country are handled by generic field filtering.
    // qualification → highestQualification is a custom param mapping.
    buildListFilters: (query) => {
      const filters: any[] = [];
      if (query.qualification) filters.push(eq(candidates.highestQualification, query.qualification as string));
      return filters;
    },
  },
};
