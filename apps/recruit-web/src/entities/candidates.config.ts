import type { EntityUIConfig } from '@packages/entity-engine-ui';
import { SkillsManager } from '../portals/recruiter/features/candidates/components/SkillsManager';
import { ResumeSection } from '../portals/recruiter/features/candidates/components/ResumeSection';

/**
 * Frontend UI config for the Candidates entity.
 * Registers detail page plugin sections (Skills, Resume).
 */
export const CANDIDATES_UI_CONFIG: EntityUIConfig = {
  entityType: 'candidates',
  detailPlugins: [
    { component: SkillsManager as any, label: 'Skills', order: 1 },
    { component: ResumeSection as any, label: 'Resume', order: 2 },
  ],
};
