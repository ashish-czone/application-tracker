import { useState } from 'react';
import { Dialog, DialogContent } from '@packages/ui';
import { useEntityEngine } from '@packages/entity-engine-ui';
import { TemplateList, TemplateEditor, TemplatePreview } from '@packages/document-templates-ui';
import type { DocumentTemplate } from '@packages/document-templates-ui';

type View = { mode: 'list' } | { mode: 'edit'; template: DocumentTemplate | null } | { mode: 'preview'; template: DocumentTemplate };

export function TemplatesPage() {
  const { apiFn } = useEntityEngine();
  const [view, setView] = useState<View>({ mode: 'list' });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Document Templates</h1>
        <p className="text-sm text-muted-foreground">Manage letter templates for offers, appointments, and more</p>
      </div>

      {view.mode === 'list' && (
        <TemplateList
          apiFn={apiFn}
          onEdit={(template) => setView({ mode: 'edit', template })}
          onCreate={() => setView({ mode: 'edit', template: null })}
          onPreview={(template) => setView({ mode: 'preview', template })}
        />
      )}

      <Dialog open={view.mode === 'edit'} onOpenChange={(open) => { if (!open) setView({ mode: 'list' }); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          {view.mode === 'edit' && (
            <TemplateEditor
              apiFn={apiFn}
              template={view.template}
              onClose={() => setView({ mode: 'list' })}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={view.mode === 'preview'} onOpenChange={(open) => { if (!open) setView({ mode: 'list' }); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          {view.mode === 'preview' && (
            <TemplatePreview
              apiFn={apiFn}
              templateId={view.template.id}
              templateName={view.template.name}
              onClose={() => setView({ mode: 'list' })}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
