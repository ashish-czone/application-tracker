import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { fieldTypeRegistry } from '@packages/field-types';
import { coreFieldTypesPlugin } from '@packages/entity-engine/field-types';
import { eavFieldTypesPlugin } from '@packages/eav-attributes/field-types';
import { taxonomyFieldTypesPlugin } from '@packages/taxonomy/field-types';
import { workflowFieldTypesPlugin } from '@packages/workflows/field-types';

fieldTypeRegistry.registerPlugin(coreFieldTypesPlugin);
fieldTypeRegistry.registerPlugin(eavFieldTypesPlugin);
fieldTypeRegistry.registerPlugin(taxonomyFieldTypesPlugin);
fieldTypeRegistry.registerPlugin(workflowFieldTypesPlugin);

import '@packages/eav-attributes-ui/field-types/register-all';
import { registerEntityRelationsFieldTypes } from '@packages/entity-relations-ui';
import { registerRatingFieldType } from '@packages/evaluations-ui';
registerEntityRelationsFieldTypes();
registerRatingFieldType();

import { WebShell } from '@packages/app-shell-ui';
import { TASKS_UI_CONFIG, TaskAssigneeCell } from '@packages/tasks-ui';
import { NotesSection } from '@packages/notes-ui';
import { AttachmentsSection } from '@packages/attachments-ui';
import { EvaluationsSection } from '@packages/evaluations-ui';
import { AuditTimeline } from '@packages/audit-ui';
import { AvatarNameCell, createStatusBadgeCell, type StatusColors } from '@packages/ui';
import { CheckSquare, Building2, UserCog } from 'lucide-react';
import type { MenuItem } from '@packages/domains';
import { recruitWeb } from '@domains/recruit-ui';
import { api } from './lib/api';
import './globals.css';

const RECRUIT_STATUS_COLORS: Record<string, StatusColors> = {
  // Candidate statuses
  'new': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  'in-review': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  'qualified': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'unqualified': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' },
  'junk-candidate': { bg: 'bg-gray-50', text: 'text-gray-500', dot: 'bg-gray-400' },
  'contacted': { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  'contact-in-future': { bg: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-500' },
  'not-contacted': { bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400' },
  'attempted-to-contact': { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  'reviewed': { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500' },
  // Job opening statuses
  'in-progress': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  'waiting-for-approval': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  'on-hold': { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-400' },
  'filled': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'cancelled': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' },
  'declined': { bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-400' },
  'inactive': { bg: 'bg-gray-50', text: 'text-gray-500', dot: 'bg-gray-400' },
  'submitted-by-client': { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  // Interview statuses
  'scheduled': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  'completed': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'no-show': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' },
  'rescheduled': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  // Application stages
  'phone-screen': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  'technical': { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  'on-site': { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  'final': { bg: 'bg-pink-50', text: 'text-pink-700', dot: 'bg-pink-500' },
  'offer': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  'hired': { bg: 'bg-green-50', text: 'text-green-800', dot: 'bg-green-600' },
  'rejected': { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' },
  'withdrawn': { bg: 'bg-gray-50', text: 'text-gray-500', dot: 'bg-gray-400' },
  // Task statuses
  'open': { bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400' },
  'in_progress': { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  'done': { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
};

const RecruitStatusBadge = createStatusBadgeCell(RECRUIT_STATUS_COLORS);

const addonMenuItems: MenuItem[] = [
  { path: '/tasks', label: 'Tasks', icon: CheckSquare, position: 'after' },
  { path: '/org-units', label: 'Org Structure', icon: Building2, permission: 'org-units.read', position: 'after' },
  { path: '/org-positions', label: 'Org Positions', icon: UserCog, permission: 'org-units.read', position: 'after' },
];

const detailTabs = [
  { key: 'notes', label: 'Notes', order: 100, component: NotesSection, featureFlag: 'hasNotes' },
  { key: 'attachments', label: 'Attachments', order: 200, component: AttachmentsSection, featureFlag: 'hasAttachments' },
  { key: 'evaluations', label: 'Evaluations', order: 300, component: EvaluationsSection, featureFlag: 'hasEvaluations' },
  { key: 'audit-trail', label: 'Audit Trail', order: 1000, component: AuditTimeline },
];

const rightSidebarPanels = [
  { key: 'notes', label: 'Notes', order: 100, component: NotesSection, featureFlag: 'hasNotes' },
  { key: 'files', label: 'Files', order: 200, component: AttachmentsSection, featureFlag: 'hasAttachments' },
  { key: 'evaluations', label: 'Evaluations', order: 300, component: EvaluationsSection, featureFlag: 'hasEvaluations' },
];

const columnRenderers = {
  StatusBadge: { component: RecruitStatusBadge },
  AvatarNameCell: { component: AvatarNameCell },
  TaskAssigneeCell: { component: TaskAssigneeCell },
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WebShell
      domains={[recruitWeb]}
      apiFn={api}
      brandLabel="Recruit"
      extraMenuItems={addonMenuItems}
      extraEntityUIConfigs={[TASKS_UI_CONFIG]}
      extraDetailTabs={detailTabs}
      extraRightSidebarPanels={rightSidebarPanels}
      extraColumnRenderers={columnRenderers}
    />
  </StrictMode>,
);
