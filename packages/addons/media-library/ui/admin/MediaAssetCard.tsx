import { useState } from 'react';
import { ImageIcon } from 'lucide-react';
import type { MediaAssetRecord } from './types';

interface MediaAssetCardProps {
  asset: MediaAssetRecord;
  onClick: () => void;
}

export function MediaAssetCard({ asset, onClick }: MediaAssetCardProps) {
  const [imageError, setImageError] = useState(false);
  const canRender = !imageError && asset.mimeType.startsWith('image/');

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex aspect-square overflow-hidden rounded-lg border border-rule bg-paper-raised transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      title={asset.originalName}
    >
      {canRender ? (
        <img
          src={asset.url}
          alt={asset.altText ?? asset.originalName}
          loading="lazy"
          onError={() => setImageError(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
          <ImageIcon className="h-8 w-8" />
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        <p className="truncate text-xs font-medium text-white">{asset.originalName}</p>
      </div>
    </button>
  );
}
