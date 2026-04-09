import { Button } from '@packages/ui';
import { X } from 'lucide-react';
import { useTemplatePreview } from '../hooks';
import type { ApiFn } from '../hooks';

interface TemplatePreviewProps {
  apiFn: ApiFn;
  templateId: string;
  templateName: string;
  onClose: () => void;
}

export function TemplatePreview({ apiFn, templateId, templateName, onClose }: TemplatePreviewProps) {
  const { data, isLoading } = useTemplatePreview(apiFn, templateId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Preview: {templateName}</h2>
          <p className="text-xs text-muted-foreground">Rendered with sample placeholder values</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {data?.subject && (
        <div className="rounded-md bg-muted/50 px-3 py-2">
          <p className="text-xs text-muted-foreground">Subject</p>
          <p className="text-sm font-medium text-foreground">{data.subject}</p>
        </div>
      )}

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <iframe
            sandbox=""
            srcDoc={data?.html ?? ''}
            title="Template preview"
            className="w-full border-0 bg-white"
            style={{ minHeight: 400, maxHeight: 600 }}
          />
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}
