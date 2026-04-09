import { useState, useRef } from 'react';
import { Button, toast } from '@packages/ui';
import { Save, X } from 'lucide-react';
import { useCreateTemplate, useUpdateTemplate, useTemplateCategories } from '../hooks';
import type { DocumentTemplate, PlaceholderDefinition } from '../types';

interface TemplateEditorProps {
  apiFn: any;
  /** Template to edit, or null for create mode */
  template: DocumentTemplate | null;
  /** Pre-selected category for create mode */
  defaultCategory?: string;
  onClose: () => void;
}

export function TemplateEditor({ apiFn, template, defaultCategory, onClose }: TemplateEditorProps) {
  const isEditing = !!template;
  const { data: categories = [] } = useTemplateCategories(apiFn);
  const createMutation = useCreateTemplate(apiFn);
  const updateMutation = useUpdateTemplate(apiFn);

  const [name, setName] = useState(template?.name ?? '');
  const [category, setCategory] = useState(template?.category ?? defaultCategory ?? '');
  const [subject, setSubject] = useState(template?.subject ?? '');
  const [htmlBody, setHtmlBody] = useState(template?.htmlBody ?? '');
  const [isDefault, setIsDefault] = useState(template?.isDefault ?? false);

  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const selectedCategory = categories.find((c) => c.category === category);
  const placeholders = selectedCategory?.placeholders ?? [];

  const insertPlaceholder = (placeholder: PlaceholderDefinition) => {
    const textarea = bodyRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const tag = `{{${placeholder.key}}}`;
    const newBody = htmlBody.slice(0, start) + tag + htmlBody.slice(end);
    setHtmlBody(newBody);
    // Restore cursor position after the inserted tag
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    });
  };

  const handleSave = () => {
    if (!name.trim() || !category.trim() || !htmlBody.trim()) {
      toast.error('Name, category, and body are required');
      return;
    }

    if (isEditing) {
      updateMutation.mutate(
        { id: template.id, name, subject: subject || undefined, htmlBody, isDefault },
        {
          onSuccess: () => { toast.success('Template updated'); onClose(); },
          onError: (err: any) => toast.error(err?.message ?? 'Failed to update'),
        },
      );
    } else {
      createMutation.mutate(
        { name, category, subject: subject || undefined, htmlBody, isDefault },
        {
          onSuccess: () => { toast.success('Template created'); onClose(); },
          onError: (err: any) => toast.error(err?.message ?? 'Failed to create'),
        },
      );
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">
          {isEditing ? 'Edit Template' : 'Create Template'}
        </h2>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Name + Category row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Standard Offer Letter"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
          {isEditing ? (
            <input
              type="text"
              value={category}
              disabled
              className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
            />
          ) : (
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select category...</option>
              {categories.map((c) => (
                <option key={c.category} value={c.category}>{c.category}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Subject */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Subject (optional)</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Offer of Employment — {{jobTitle}}"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      {/* Placeholders */}
      {placeholders.length > 0 && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Insert Placeholder
          </label>
          <div className="flex flex-wrap gap-1.5">
            {placeholders.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => insertPlaceholder(p)}
                className="inline-flex items-center rounded-md bg-primary/10 text-primary px-2 py-1 text-xs font-medium hover:bg-primary/20 transition-colors"
                title={p.sampleValue ? `Sample: ${p.sampleValue}` : undefined}
              >
                {`{{${p.key}}}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Body */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Template Body (HTML)</label>
        <textarea
          ref={bodyRef}
          value={htmlBody}
          onChange={(e) => setHtmlBody(e.target.value)}
          rows={16}
          placeholder="<h1>Offer of Employment</h1><p>Dear {{candidateFirstName}},</p>..."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono leading-relaxed resize-y"
        />
      </div>

      {/* Default toggle */}
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          className="rounded border-input"
        />
        Set as default template for this category
      </label>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          <Save className="h-3.5 w-3.5 mr-1.5" />
          {isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
