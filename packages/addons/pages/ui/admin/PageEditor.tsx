import { useMemo, useState, useEffect } from 'react';
import { Puck, type Config, type Data } from '@measured/puck';
import '@measured/puck/puck.css';
import { blockRegistry, type BlockDefinition } from '@packages/blocks-ui';
import {
  buildPuckConfig,
  puckDataToSections,
  sectionsToPuckData,
} from './puck-adapter';
import { usePage, useSectionsForPage, useSavePageSections } from './hooks';
import type { SectionRecord } from './types';

export interface PageEditorProps {
  pageId: string;
  onSaved?: () => void;
  /** Override the block list. Defaults to everything in the singleton registry. */
  blocks?: BlockDefinition[];
  /**
   * Entity slugs the host app has registered. Filters the Puck block picker
   * via `block.supports` — content blocks needing entities the app hasn't
   * installed disappear from the palette. Omit to show every block.
   */
  availableEntities?: string[];
}

export function PageEditor({ pageId, onSaved, blocks, availableEntities }: PageEditorProps) {
  const { data: page, isLoading: pageLoading } = usePage(pageId);
  const { data: sectionsResp, isLoading: sectionsLoading } = useSectionsForPage(pageId);
  const save = useSavePageSections();

  const registeredBlocks = useMemo(() => blocks ?? blockRegistry.list(), [blocks]);
  const puckConfig = useMemo<Config>(
    () => buildPuckConfig(registeredBlocks, { availableEntities }) as unknown as Config,
    [registeredBlocks, availableEntities],
  );

  const initialData = useMemo<Data | null>(() => {
    if (!sectionsResp) return null;
    return sectionsToPuckData(sectionsResp.data as unknown as SectionRecord[]) as unknown as Data;
  }, [sectionsResp]);

  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    if (initialData) setData(initialData);
  }, [initialData]);

  if (pageLoading || sectionsLoading || !data) {
    return <div className="p-6 text-sm text-muted-foreground">Loading editor…</div>;
  }

  async function handleSave(nextData: Data) {
    if (!sectionsResp) return;
    const drafts = puckDataToSections(nextData as any).map((d) => ({
      order: d.order,
      blockKind: d.blockKind,
      variant: d.variant,
      customFields: d.customFields,
    }));
    const existingIds = sectionsResp.data.map((s) => s.id);
    await save.mutateAsync({ pageId, existingIds, drafts });
    setData(nextData);
    onSaved?.();
  }

  return (
    <div className="h-screen w-full">
      <div className="border-b px-4 py-2 text-sm font-medium flex items-center gap-2">
        <span className="text-muted-foreground">Editing:</span>
        <span>{page?.title ?? pageId}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {save.isPending ? 'Saving…' : save.isError ? 'Save failed' : ''}
        </span>
      </div>
      <Puck
        config={puckConfig}
        data={data}
        onPublish={handleSave}
      />
    </div>
  );
}
