import type { EntityUIConfig } from '@packages/entity-engine-ui';

export const JOB_OPENINGS_UI_CONFIG: EntityUIConfig = {
  entityType: 'job_openings',
  presentation: {
    icon: 'briefcase',
    subtitleField: 'department',
    navGroup: 'recruit',
    navOrder: 1,
    createMode: 'page',
  },
  fieldUI: {
    status: { cellRenderer: 'StatusBadge' },
  },
  actionUI: {
    edit: { label: 'Edit', icon: 'Pencil' },
    clone: { label: 'Clone', icon: 'Copy' },
    delete: { label: 'Delete', icon: 'Trash2', variant: 'destructive' },
    massUpdate: { label: 'Mass Update', icon: 'PenLine' },
    massDelete: { label: 'Mass Delete', icon: 'Trash2', variant: 'destructive' },
    export: { label: 'Export', icon: 'Download' },
    'apply-candidate': { label: 'Apply Candidate', icon: 'UserPlus' },
  },
};
