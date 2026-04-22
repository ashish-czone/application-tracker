import { useRef, useState, type ChangeEvent } from 'react';
import { UploadCloud, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button, SearchInput } from '@packages/ui';
import { useMediaAssets, useUploadMediaAsset } from '../hooks';
import { MediaAssetCard } from '../MediaAssetCard';
import type { MediaAssetRecord } from '../types';

interface MediaPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (asset: MediaAssetRecord) => void;
}

export function MediaPickerDialog({ open, onOpenChange, onSelect }: MediaPickerDialogProps) {
  const [search, setSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const apiBaseUrl = import.meta.env.VITE_API_URL || '/api/v1';
  const { data, isLoading } = useMediaAssets({ search: search || undefined, limit: 48 });
  const uploadMutation = useUploadMediaAsset(apiBaseUrl);

  const assets = data?.data ?? [];

  const handleFilePicked = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    uploadMutation.mutate(
      { file },
      {
        onSuccess: (asset) => {
          onSelect(asset);
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select media</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search library…"
            className="flex-1"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
          >
            {uploadMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <UploadCloud className="h-4 w-4 mr-2" />
            )}
            Upload new
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
            className="hidden"
            onChange={handleFilePicked}
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          )}
          {!isLoading && assets.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
              <p>No media found.</p>
              <p className="text-xs mt-1">Upload a new file to get started.</p>
            </div>
          )}
          {!isLoading && assets.length > 0 && (
            <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
              {assets.map((asset) => (
                <MediaAssetCard
                  key={asset.id}
                  asset={asset}
                  onClick={() => {
                    onSelect(asset);
                    onOpenChange(false);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
