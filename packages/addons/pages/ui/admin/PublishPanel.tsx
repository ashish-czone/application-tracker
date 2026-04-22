import { useEffect, useState } from 'react';
import { Button, Badge, FormSelect, FormDatePicker } from '@packages/ui';
import { useUpdatePage } from './hooks';
import type { PageRecord, PageStatus } from './types';

const STATUS_OPTIONS: { value: PageStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

const STATUS_VARIANT: Record<PageStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  scheduled: 'secondary',
  published: 'default',
  archived: 'destructive',
};

export interface PublishPanelProps {
  page: PageRecord;
}

/**
 * Inline publish controls for the page editor. Writes status + publishedAt
 * through the generic entity PATCH endpoint; the public page service reads
 * these to gate what anonymous visitors can see.
 */
export function PublishPanel({ page }: PublishPanelProps) {
  const update = useUpdatePage();
  const [status, setStatus] = useState<PageStatus>(page.status);
  const [publishedAt, setPublishedAt] = useState<string>(page.publishedAt ?? '');

  useEffect(() => {
    setStatus(page.status);
    setPublishedAt(page.publishedAt ?? '');
  }, [page.id, page.status, page.publishedAt]);

  const dirty = status !== page.status || (publishedAt || null) !== (page.publishedAt ?? null);

  async function save() {
    const input: { status?: PageStatus; publishedAt?: string | null } = {};
    if (status !== page.status) input.status = status;
    if ((publishedAt || null) !== (page.publishedAt ?? null)) {
      input.publishedAt = publishedAt ? new Date(publishedAt).toISOString() : null;
    }
    await update.mutateAsync({ id: page.id, input });
  }

  async function publishNow() {
    await update.mutateAsync({
      id: page.id,
      input: { status: 'published', publishedAt: new Date().toISOString() },
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 px-4 py-3 border-b bg-muted/30">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Status</span>
        <Badge variant={STATUS_VARIANT[page.status]} className="uppercase tracking-wide text-[10px]">
          {page.status}
        </Badge>
      </div>

      <div className="w-40">
        <FormSelect
          value={status}
          onChange={(v) => setStatus(v as PageStatus)}
          options={STATUS_OPTIONS}
          placeholder="Status"
        />
      </div>

      <div className="w-60">
        <FormDatePicker
          value={publishedAt}
          onChange={setPublishedAt}
          includeTime
          placeholder="Publish date"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {update.isPending && <span className="text-xs text-muted-foreground">Saving…</span>}
        {update.isError && <span className="text-xs text-destructive">Save failed</span>}
        <Button variant="secondary" size="sm" onClick={save} disabled={!dirty || update.isPending}>
          Save schedule
        </Button>
        {page.status !== 'published' && (
          <Button size="sm" onClick={publishNow} disabled={update.isPending}>
            Publish now
          </Button>
        )}
      </div>
    </div>
  );
}
