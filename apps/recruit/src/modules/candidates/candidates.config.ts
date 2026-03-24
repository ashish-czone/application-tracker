import { eq, ilike } from 'drizzle-orm';
import type { EntityConfig } from '@packages/entity-engine';
import type { MediaFile } from '@packages/media';
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
export const CANDIDATES_CONFIG: EntityConfig = {
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

  features: {
    softDelete: true,
    restore: true,
    taxonomy: { tagGroupSlug: 'recruit-skills', label: 'Skills' },
    media: {
      resume: {
        accept: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        label: 'Resume',
        maxFileSize: 10 * 1024 * 1024,
      },
    },
  },

  lookup: {
    labelField: 'firstName',
    searchFields: ['firstName', 'lastName', 'email'],
  },

  relationships: [
    {
      name: 'applications',
      type: 'hasMany',
      targetEntity: 'applications',
      foreignKey: 'candidateId',
      label: 'Applications',
      displayFields: ['status', 'stage', 'createdAt'],
    },
  ],

  recipientFields: {
    createdBy: { label: 'Created By (recruiter)' },
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
