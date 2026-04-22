import { useMemo, useState, useRef, type ChangeEvent, type DragEvent } from 'react';
import { UploadCloud, ImageIcon, Search, Loader2, AlertCircle } from 'lucide-react';
import { Button, SearchInput } from '@packages/ui';
import { useMediaAssets, useUploadMediaAsset } from './hooks';
import { MediaAssetCard } from './MediaAssetCard';
import { MediaAssetDrawer } from './MediaAssetDrawer';
import type { MediaAssetRecord } from './types';

interface PendingUpload {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function MediaLibraryPage() {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragDepth, setDragDepth] = useState(0);

  const apiBaseUrl = import.meta.env.VITE_API_URL || '/api/v1';
  const { data, isLoading, isError } = useMediaAssets({ search: search || undefined, limit: 48 });
  const uploadMutation = useUploadMediaAsset(apiBaseUrl);

  const assets = data?.data ?? [];
  const meta = data?.meta;

  const queueUploads = (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    const entries: PendingUpload[] = list.map((file) => ({ id: uid(), file, status: 'pending' }));
    setPending((prev) => [...prev, ...entries]);

    for (const entry of entries) {
      setPending((prev) => prev.map((p) => (p.id === entry.id ? { ...p, status: 'uploading' } : p)));
      uploadMutation.mutate(
        { file: entry.file },
        {
          onSuccess: () => {
            setPending((prev) => prev.map((p) => (p.id === entry.id ? { ...p, status: 'done' } : p)));
            setTimeout(() => setPending((prev) => prev.filter((p) => p.id !== entry.id)), 1200);
          },
          onError: (err) => {
            setPending((prev) =>
              prev.map((p) => (p.id === entry.id ? { ...p, status: 'error', error: err.message } : p)),
            );
          },
        },
      );
    }
  };

  const handleFilesPicked = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) queueUploads(e.target.files);
    e.target.value = '';
  };

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragDepth((d) => d + 1);
  };
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragDepth((d) => Math.max(0, d - 1));
  };
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragDepth(0);
    if (e.dataTransfer.files.length > 0) queueUploads(e.dataTransfer.files);
  };

  const selectedAsset = useMemo(
    () => assets.find((a) => a.id === selectedId) ?? null,
    [assets, selectedId],
  );

  const isDragging = dragDepth > 0;

  return (
    <div
      className="relative flex flex-col gap-4 p-6"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Media Library</h1>
          <p className="text-sm text-muted-foreground">
            {meta ? `${meta.total} asset${meta.total === 1 ? '' : 's'}` : 'Loading…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, alt, caption…"
            className="w-72"
          />
          <Button onClick={() => fileInputRef.current?.click()}>
            <UploadCloud className="h-4 w-4 mr-2" />
            Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
            className="hidden"
            onChange={handleFilesPicked}
          />
        </div>
      </div>

      {pending.length > 0 && (
        <div className="rounded-lg border border-rule bg-paper-raised p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Uploading {pending.filter((p) => p.status !== 'done').length} file(s)
          </p>
          <ul className="space-y-1.5">
            {pending.map((p) => (
              <li key={p.id} className="flex items-center gap-3 text-xs">
                {p.status === 'uploading' && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                {p.status === 'done' && <span className="text-emerald-600">✓</span>}
                {p.status === 'error' && <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
                <span className="flex-1 truncate text-foreground">{p.file.name}</span>
                <span className="text-muted-foreground">{humanSize(p.file.size)}</span>
                {p.status === 'error' && p.error && (
                  <span className="text-destructive truncate max-w-xs">{p.error}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load media assets.
        </div>
      )}

      {!isLoading && !isError && assets.length === 0 && pending.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-rule py-16 text-center">
          <ImageIcon className="h-10 w-10 text-muted-foreground" />
          <h2 className="text-sm font-medium text-foreground">No media yet</h2>
          <p className="text-xs text-muted-foreground max-w-sm">
            Drag and drop images anywhere on this page, or click Upload to pick files.
          </p>
          <Button onClick={() => fileInputRef.current?.click()} className="mt-2">
            <UploadCloud className="h-4 w-4 mr-2" />
            Upload images
          </Button>
        </div>
      )}

      {!isLoading && !isError && assets.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-rule text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <UploadCloud className="h-6 w-6" />
            <span className="text-xs font-medium">Upload</span>
          </button>
          {assets.map((asset) => (
            <MediaAssetCard key={asset.id} asset={asset} onClick={() => setSelectedId(asset.id)} />
          ))}
        </div>
      )}

      {selectedAsset && (
        <MediaAssetDrawer
          asset={selectedAsset}
          onClose={() => setSelectedId(null)}
        />
      )}

      {isDragging && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-primary/10">
          <div className="rounded-xl border-2 border-dashed border-primary bg-paper-raised px-6 py-4 text-primary">
            <UploadCloud className="mx-auto mb-2 h-8 w-8" />
            <p className="text-sm font-medium">Drop to upload</p>
          </div>
        </div>
      )}
    </div>
  );
}

export type { MediaAssetRecord };
