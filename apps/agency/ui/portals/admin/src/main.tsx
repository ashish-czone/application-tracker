import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { Route } from 'react-router';
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
registerEntityRelationsFieldTypes();

import { WebShell } from '@packages/app-shell-ui';
import { EntityListPage, EntityDetailPage } from '@packages/entity-engine-ui';
import { registerStarterBlocks } from '@packages/pages-ui-frontend';
import { PageEditorPage } from '@packages/pages-ui-admin';
import { AuditTimeline } from '@packages/audit-ui';
import { Toaster } from '@packages/ui';
import { FileText } from 'lucide-react';
import type { MenuItem } from '@packages/domains';
import { api } from './lib/api';
import './globals.css';

registerStarterBlocks();

const pagesMenu: MenuItem[] = [
  { path: '/pages', label: 'Pages', icon: FileText, permission: 'pages.read' },
];

const pagesRoutes = [
  {
    path: '/pages',
    children: [
      { index: true, element: <EntityListPage entityType="pages" /> },
      { path: ':id', element: <EntityDetailPage entityType="pages" /> },
      { path: ':id/edit', element: <PageEditorPage /> },
    ],
  },
];

const detailTabs = [
  { key: 'audit-trail', label: 'Audit Trail', order: 1000, component: AuditTimeline },
];

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WebShell
      domains={[]}
      apiFn={api}
      brandLabel="Agency Admin"
      extraMenuItems={pagesMenu}
      extraRoutes={pagesRoutes}
      extraDetailTabs={detailTabs}
    />
    <Toaster />
  </StrictMode>,
);
