import type { EntityUIConfig } from '@packages/entity-engine-ui';
import { SkillsManager } from '../portals/recruiter/features/candidates/components/SkillsManager';
import { ResumeSection } from '../portals/recruiter/features/candidates/components/ResumeSection';

export const CANDIDATES_UI_CONFIG: EntityUIConfig = {
  entityType: 'candidates',
  presentation: {
    icon: 'users',
    navGroup: 'recruit',
    navOrder: 1,
  },
  fieldUI: {
    fullName: { cellRenderer: 'AvatarNameCell' },
  },
  actionUI: {
    edit: { label: 'Edit', icon: 'Pencil' },
    clone: { label: 'Clone', icon: 'Copy' },
    delete: { label: 'Delete', icon: 'Trash2', variant: 'destructive' },
    massUpdate: { label: 'Mass Update', icon: 'PenLine' },
    massDelete: { label: 'Mass Delete', icon: 'Trash2', variant: 'destructive' },
    export: { label: 'Export', icon: 'Download' },
    'apply-to-job': { label: 'Apply to Job', icon: 'Briefcase' },
  },
  detailPlugins: [
    { component: SkillsManager as any, label: 'Skills', order: 1 },
    { component: ResumeSection as any, label: 'Resume', order: 2 },
  ],
};
