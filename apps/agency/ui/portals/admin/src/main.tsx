import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useNavigate } from 'react-router';
import { fieldTypeRegistry } from '@packages/field-types';
import { coreFieldTypesPlugin } from '@packages/entity-engine/field-types';
import { eavFieldTypesPlugin } from '@packages/eav-attributes/field-types';
import { taxonomyFieldTypesPlugin } from '@packages/taxonomy/field-types';
import { workflowFieldTypesPlugin } from '@packages/workflows/field-types';
import { mediaLibraryFieldTypesPlugin } from '@packages/media-library-api/field-types';

fieldTypeRegistry.registerPlugin(coreFieldTypesPlugin);
fieldTypeRegistry.registerPlugin(eavFieldTypesPlugin);
fieldTypeRegistry.registerPlugin(taxonomyFieldTypesPlugin);
fieldTypeRegistry.registerPlugin(workflowFieldTypesPlugin);
fieldTypeRegistry.registerPlugin(mediaLibraryFieldTypesPlugin);

import '@packages/eav-attributes-ui/field-types/register-all';
import { registerEntityRelationsFieldTypes } from '@packages/entity-relations-ui';
import { registerMediaLibraryFieldTypes } from '@packages/media-library-ui-admin';
registerEntityRelationsFieldTypes();
registerMediaLibraryFieldTypes();

import { WebShell } from '@packages/app-shell-ui';
import { taxonomyWeb } from '@packages/taxonomy-ui';
import { workflowsWeb } from '@packages/workflows-ui';
import { automationsWeb } from '@packages/automations-ui';
import { registerStarterBlocks, registerContentBlocks, agencyEntityUIConfigs } from '@domains/agency-ui';
import { PageEditorPage } from '@domains/agency-ui';
import { MenuEditorPage } from '@domains/agency-ui';
import { MediaLibraryPage } from '@packages/media-library-ui-admin';
import { AuditTimeline } from '@packages/audit-ui';
import { Button, Toaster } from '@packages/ui';
import { Pencil, Image as ImageIcon, Palette, Sparkles } from 'lucide-react';
import AppearancePage from './pages/AppearancePage';
import BrandingPage from './pages/BrandingPage';
import { api } from './lib/api';
import './globals.css';

registerStarterBlocks();
registerContentBlocks();

const contentRoutes = [
  { path: '/pages/:id/edit', element: <PageEditorPage /> },
  { path: '/menus/:id/edit', element: <MenuEditorPage /> },
  { path: '/media-library', element: <MediaLibraryPage /> },
  { path: '/appearance', element: <AppearancePage /> },
  { path: '/branding', element: <BrandingPage /> },
];

const extraMenuItems = [
  { path: '/media-library', label: 'Media Library', icon: ImageIcon, position: 'after' as const },
  { path: '/branding', label: 'Branding', icon: Sparkles, position: 'after' as const },
  { path: '/appearance', label: 'Appearance', icon: Palette, position: 'after' as const },
];

const detailTabs = [
  { key: 'audit-trail', label: 'Audit Trail', order: 1000, component: AuditTimeline },
];

function OpenEditorButton({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate();
  return (
    <Button size="sm" onClick={() => navigate(to)}>
      <Pencil className="h-4 w-4 mr-1" />
      {label}
    </Button>
  );
}

const detailHeaderActions = {
  pages: (entityId: string) => <OpenEditorButton to={`/pages/${entityId}/edit`} label="Open Editor" />,
  menus: (entityId: string) => <OpenEditorButton to={`/menus/${entityId}/edit`} label="Edit Menu" />,
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WebShell
      domains={[]}
      apiFn={api}
      brandLabel="Agency Admin"
      features={[taxonomyWeb, workflowsWeb, automationsWeb]}
      extraRoutes={contentRoutes}
      extraMenuItems={extraMenuItems}
      extraDetailTabs={detailTabs}
      extraDetailHeaderActions={detailHeaderActions}
      extraEntityUIConfigs={agencyEntityUIConfigs}
    />
    <Toaster />
  </StrictMode>,
);
