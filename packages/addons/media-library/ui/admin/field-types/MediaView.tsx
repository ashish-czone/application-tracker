import { ImageIcon } from 'lucide-react';
import type { FieldRenderProps } from '@packages/field-types/ui';
import { useMediaAsset } from '../hooks';

/**
 * Read-only thumbnail + filename display for a `media` field value.
 * Value is a UUID referencing a media_assets row; we fetch the asset
 * to render its thumbnail inline. Falls back to the resolved label
 * from the list API when the asset hasn't loaded yet.
 */
export function MediaView(value: unknown, props: FieldRenderProps) {
  const id = typeof value === 'string' && value ? value : null;
  return <MediaViewInner id={id} fallback={props.resolvedLabel ?? null} />;
}

function MediaViewInner({ id, fallback }: { id: string | null; fallback: string | null }) {
  const { data: asset } = useMediaAsset(id ?? undefined);

  if (!id) return <span className="text-sm text-muted-foreground">-</span>;

  if (!asset) {
    return <span className="text-sm text-muted-foreground">{fallback ?? '…'}</span>;
  }

  const isImage = asset.mimeType.startsWith('image/');

  return (
    <div className="flex items-center gap-2">
      <div className="h-10 w-10 overflow-hidden rounded border border-rule bg-paper-raised">
        {isImage ? (
          <img src={asset.url} alt={asset.altText ?? asset.originalName} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageIcon className="h-4 w-4" />
          </div>
        )}
      </div>
      <span className="truncate text-sm text-foreground">{asset.originalName}</span>
    </div>
  );
}

/** Plain-text rendering for DataGrid cells — no thumbnails. */
export function mediaCell(value: unknown, row: Record<string, unknown>, props: FieldRenderProps): string {
  if (!value) return '-';
  const label = row[`${props.field.fieldKey}__label`];
  if (label != null) return String(label);
  return props.resolvedLabel ?? String(value);
}
