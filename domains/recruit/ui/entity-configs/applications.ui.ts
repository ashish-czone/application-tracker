import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const APPLICATIONS_UI_CONFIG: EntityUIConfig = {
  entityType: 'applications',
  presentation: {
    singularName: 'Application',
    pluralName: 'Applications',
    icon: 'file-text',
    navGroup: 'recruit',
    navOrder: 3,
  },
  fieldUI: {
    candidateId: { label: 'Candidate' },
    jobOpeningId: { label: 'Job Opening' },
    source: { label: 'Source' },
    referredBy: { label: 'Referred By' },
    stage: { label: 'Stage', cellRenderer: 'PipelineProgressRenderer' },
    notes: { label: 'Notes' },
    averageRating: { label: 'Avg Rating', cellRenderer: 'RatingRenderer' },
    evaluationsCount: { label: 'Reviews' },
  },
  formLayout: {
    sections: [
      { name: 'Basic Info', fields: ['candidateId', 'jobOpeningId', 'stage', 'source', 'referredBy'] },
      { name: 'Details', fields: ['notes'] },
    ],
    quickCreateFields: ['candidateId', 'jobOpeningId'],
  },
  listColumns: [
    { fieldKey: 'candidateId', visible: true, order: 0 },
    { fieldKey: 'jobOpeningId', visible: true, order: 1 },
    { fieldKey: 'stage', visible: true, order: 2 },
    { fieldKey: 'source', visible: true, order: 3 },
    { fieldKey: 'averageRating', visible: true, order: 4 },
  ],
};
