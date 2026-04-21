import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useNavigate } from 'react-router';
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
import { registerStarterBlocks } from '@packages/pages-ui-frontend';
import { PageEditorPage } from '@packages/pages-ui-admin';
import { MenuEditorPage } from '@packages/menus-ui-admin';
import { AuditTimeline } from '@packages/audit-ui';
import { Button, Toaster } from '@packages/ui';
import { FileText, Menu as MenuIcon, Pencil } from 'lucide-react';
import type { MenuItem } from '@packages/domains';
import { api } from './lib/api';
import './globals.css';

registerStarterBlocks();

const contentMenu: MenuItem[] = [
  { path: '/pages', label: 'Pages', icon: FileText, permission: 'pages.read' },
  { path: '/menus', label: 'Menus', icon: MenuIcon, permission: 'menus.read' },
];

const contentRoutes = [
  { path: '/pages/:id/edit', element: <PageEditorPage /> },
  { path: '/menus/:id/edit', element: <MenuEditorPage /> },
];

const detailTabs = [
  { key: 'audit-trail', label: 'Audit Trail', order: 1000, component: AuditTimeline },
];

function OpenPageEditorButton({ entityId }: { entityId: string }) {
  const navigate = useNavigate();
  return (
    <Button size="sm" onClick={() => navigate(`/pages/${entityId}/edit`)}>
      <Pencil className="h-4 w-4 mr-1" />
      Open Editor
    </Button>
  );
}

const detailHeaderActions = {
  pages: (entityId: string) => <OpenPageEditorButton entityId={entityId} />,
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WebShell
      domains={[]}
      apiFn={api}
      brandLabel="Agency Admin"
      extraMenuItems={contentMenu}
      extraRoutes={contentRoutes}
      extraDetailTabs={detailTabs}
      extraDetailHeaderActions={detailHeaderActions}
    />
    <Toaster />
  </StrictMode>,
);
