import { useState } from 'react';
import { FileText, Plus, Star, Pencil, Trash2, Eye } from 'lucide-react';
import { Button, ConfirmDialog, Badge, toast } from '@packages/ui';
import { formatDateTime } from '@packages/common';
import { useDocumentTemplates, useDeleteTemplate } from '../hooks';
import type { ApiFn } from '../hooks';
import type { DocumentTemplate } from '../types';

interface TemplateListProps {
  apiFn: ApiFn;
  category?: string;
  onEdit: (template: DocumentTemplate) => void;
  onCreate: () => void;
  onPreview: (template: DocumentTemplate) => void;
}

export function TemplateList({ apiFn, category, onEdit, onCreate, onPreview }: TemplateListProps) {
  const { data: templates = [], isLoading } = useDocumentTemplates(apiFn, category);
  const deleteMutation = useDeleteTemplate(apiFn);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-12 rounded-lg border border-dashed border-border">
        <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm font-medium text-foreground">No templates yet</p>
        <p className="text-sm text-muted-foreground mt-1">Create your first template to get started.</p>
        <Button size="sm" className="mt-4" onClick={onCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Create Template
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground">
          {category ? `${category} Templates` : 'All Templates'}
        </h2>
        <Button size="sm" onClick={onCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Create Template
        </Button>
      </div>

      <div className="space-y-2">
        {templates.map((template) => (
          <div
            key={template.id}
            className="flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{template.name}</p>
                  {template.isDefault && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                      <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />
                      Default
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {template.category} · Updated {formatDateTime(template.updatedAt)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onPreview(template)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                aria-label="Preview"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onEdit(template)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                aria-label="Edit"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setDeletingId(template.id)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                aria-label="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => { if (!open) setDeletingId(null); }}
        title="Delete template"
        description="This template will be permanently deleted."
        confirmLabel="Delete"
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (deletingId) {
            deleteMutation.mutate(deletingId, {
              onSuccess: () => {
                setDeletingId(null);
                toast.success('Template deleted');
              },
            });
          }
        }}
      />
    </div>
  );
}
