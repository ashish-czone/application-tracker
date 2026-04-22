import { useEffect, useState } from 'react';
import { Trash2, ExternalLink } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  DrawerHeader,
  DrawerShell,
  Input,
  Label,
} from '@packages/ui';
import { useDeleteMediaAsset, useUpdateMediaAsset } from './hooks';
import type { MediaAssetRecord } from './types';

interface MediaAssetDrawerProps {
  asset: MediaAssetRecord;
  onClose: () => void;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function dimensionLabel(asset: MediaAssetRecord): string | null {
  if (asset.width && asset.height) return `${asset.width} × ${asset.height}`;
  return null;
}

export function MediaAssetDrawer({ asset, onClose }: MediaAssetDrawerProps) {
  const [altText, setAltText] = useState(asset.altText ?? '');
  const [caption, setCaption] = useState(asset.caption ?? '');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const updateMutation = useUpdateMediaAsset();
  const deleteMutation = useDeleteMediaAsset();

  useEffect(() => {
    setAltText(asset.altText ?? '');
    setCaption(asset.caption ?? '');
  }, [asset.id, asset.altText, asset.caption]);

  const dirty = altText !== (asset.altText ?? '') || caption !== (asset.caption ?? '');

  const handleSave = () => {
    updateMutation.mutate({
      id: asset.id,
      input: {
        altText: altText.trim() || null,
        caption: caption.trim() || null,
      },
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate(asset.id, {
      onSuccess: () => {
        setConfirmOpen(false);
        onClose();
      },
    });
  };

  const isImage = asset.mimeType.startsWith('image/');
  const dimensions = dimensionLabel(asset);

  return (
    <>
      <DrawerShell onClose={onClose} width="xl">
        <DrawerHeader
          title={asset.originalName}
          subtitle={asset.mimeType}
          onClose={onClose}
          titleSize="sm"
        />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-center rounded-lg border border-rule bg-muted/30 p-4">
            {isImage ? (
              <img
                src={asset.url}
                alt={asset.altText ?? asset.originalName}
                className="max-h-80 max-w-full object-contain"
              />
            ) : (
              <div className="py-10 text-sm text-muted-foreground">No preview available</div>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-y-2 text-xs">
            <dt className="text-muted-foreground">Size</dt>
            <dd className="text-foreground">{humanSize(asset.size)}</dd>
            {dimensions && (
              <>
                <dt className="text-muted-foreground">Dimensions</dt>
                <dd className="text-foreground">{dimensions}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Uploaded</dt>
            <dd className="text-foreground">{new Date(asset.createdAt).toLocaleString()}</dd>
            <dt className="text-muted-foreground">URL</dt>
            <dd className="truncate">
              <a
                href={asset.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Open original
                <ExternalLink className="h-3 w-3" />
              </a>
            </dd>
          </dl>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="media-alt">Alt text</Label>
              <Input
                id="media-alt"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="Describe this image for screen readers"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="media-caption">Caption</Label>
              <textarea
                id="media-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={3}
                placeholder="Optional caption"
                className="flex w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-rule px-6 py-4">
          <Button
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmOpen(true)}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Delete
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} disabled={updateMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!dirty || updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </footer>
      </DrawerShell>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete media asset?"
        description={`${asset.originalName} will be removed from the library. Any block referencing it will show a broken image.`}
        confirmLabel="Delete asset"
        isPending={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}
