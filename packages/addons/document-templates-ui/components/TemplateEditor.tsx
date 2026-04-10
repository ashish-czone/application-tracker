import { useRef } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { Button, toast } from '@packages/ui';
import { FormInput } from '@packages/ui/components/form/FormInput';
import { FormSelect } from '@packages/ui/components/form/FormSelect';
import { FormCheckbox } from '@packages/ui/components/form/FormCheckbox';
import { Save, X } from 'lucide-react';
import { useCreateTemplate, useUpdateTemplate, useTemplateCategories } from '../hooks';
import type { ApiFn } from '../hooks';
import type { DocumentTemplate, PlaceholderDefinition } from '../types';

interface TemplateEditorProps {
  apiFn: ApiFn;
  template: DocumentTemplate | null;
  defaultCategory?: string;
  onClose: () => void;
}

interface TemplateFormValues {
  name: string;
  category: string;
  subject: string;
  htmlBody: string;
  isDefault: boolean;
}

export function TemplateEditor({ apiFn, template, defaultCategory, onClose }: TemplateEditorProps) {
  const isEditing = !!template;
  const { data: categories = [] } = useTemplateCategories(apiFn);
  const createMutation = useCreateTemplate(apiFn);
  const updateMutation = useUpdateTemplate(apiFn);

  const form = useForm<TemplateFormValues>({
    defaultValues: {
      name: template?.name ?? '',
      category: template?.category ?? defaultCategory ?? '',
      subject: template?.subject ?? '',
      htmlBody: template?.htmlBody ?? '',
      isDefault: template?.isDefault ?? false,
    },
  });

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const category = form.watch('category');
  const htmlBody = form.watch('htmlBody');

  const selectedCategory = categories.find((c) => c.category === category);
  const placeholders = selectedCategory?.placeholders ?? [];
  const categoryOptions = categories.map((c) => ({ label: c.category, value: c.category }));

  const insertPlaceholder = (placeholder: PlaceholderDefinition) => {
    const textarea = bodyRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const tag = `{{${placeholder.key}}}`;
    const newBody = htmlBody.slice(0, start) + tag + htmlBody.slice(end);
    form.setValue('htmlBody', newBody);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    });
  };

  const handleSave = form.handleSubmit((values) => {
    if (!values.name.trim() || !values.category.trim() || !values.htmlBody.trim()) {
      toast.error('Name, category, and body are required');
      return;
    }

    const payload = {
      name: values.name,
      subject: values.subject || undefined,
      htmlBody: values.htmlBody,
      isDefault: values.isDefault,
    };

    if (isEditing) {
      updateMutation.mutate(
        { id: template.id, ...payload },
        {
          onSuccess: () => { toast.success('Template updated'); onClose(); },
          onError: (err: Error) => toast.error(err?.message ?? 'Failed to update'),
        },
      );
    } else {
      createMutation.mutate(
        { ...payload, category: values.category },
        {
          onSuccess: () => { toast.success('Template created'); onClose(); },
          onError: (err: Error) => toast.error(err?.message ?? 'Failed to create'),
        },
      );
    }
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <FormProvider {...form}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            {isEditing ? 'Edit Template' : 'Create Template'}
          </h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormInput name="name" label="Name" placeholder="e.g. Standard Offer Letter" />
          {isEditing ? (
            <FormInput name="category" label="Category" disabled />
          ) : (
            <FormSelect name="category" label="Category" options={categoryOptions} placeholder="Select category..." />
          )}
        </div>

        <FormInput name="subject" label="Subject (optional)" placeholder="e.g. Offer of Employment — {{jobTitle}}" />

        {placeholders.length > 0 && (
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Insert Placeholder
            </label>
            <div className="flex flex-wrap gap-1.5">
              {placeholders.map((p) => (
                <Button
                  key={p.key}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => insertPlaceholder(p)}
                  className="h-auto bg-primary/10 text-primary px-2 py-1 text-xs font-medium hover:bg-primary/20"
                  title={p.sampleValue ? `Sample: ${p.sampleValue}` : undefined}
                >
                  {`{{${p.key}}}`}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Custom textarea with ref for placeholder cursor insertion */}
        <div className="space-y-2">
          <label htmlFor="htmlBody" className="text-sm font-medium leading-none">
            Template Body (HTML)
          </label>
          <textarea
            ref={bodyRef}
            id="htmlBody"
            value={htmlBody}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => form.setValue('htmlBody', e.target.value)}
            rows={16}
            placeholder="<h1>Offer of Employment</h1><p>Dear {{candidateFirstName}},</p>..."
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono leading-relaxed ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
          />
        </div>

        <FormCheckbox name="isDefault" label="Set as default template for this category" />

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </FormProvider>
  );
}
