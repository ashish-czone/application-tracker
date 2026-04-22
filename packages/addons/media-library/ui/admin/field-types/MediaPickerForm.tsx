import { useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { ImageIcon, X } from 'lucide-react';
import { Button, Label } from '@packages/ui';
import type { FieldRenderProps } from '@packages/field-types/ui';
import { useMediaAsset } from '../hooks';
import { MediaPickerDialog } from './MediaPickerDialog';

function fieldLabel(props: FieldRenderProps): string {
  return props.field.isRequired ? `${props.field.label} *` : props.field.label;
}

interface PreviewProps {
  assetId: string;
  onClear: () => void;
  disabled?: boolean;
}

function MediaPreview({ assetId, onClear, disabled }: PreviewProps) {
  const { data: asset, isLoading } = useMediaAsset(assetId);

  if (isLoading) {
    return <div className="h-20 w-20 animate-pulse rounded-lg bg-muted" />;
  }

  if (!asset) {
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-rule bg-muted text-xs text-muted-foreground">
        Missing
      </div>
    );
  }

  const isImage = asset.mimeType.startsWith('image/');

  return (
    <div className="flex items-start gap-3">
      <div className="h-20 w-20 overflow-hidden rounded-lg border border-rule bg-paper-raised">
        {isImage ? (
          <img src={asset.url} alt={asset.altText ?? asset.originalName} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageIcon className="h-6 w-6" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-sm font-medium text-foreground">{asset.originalName}</p>
        <p className="text-xs text-muted-foreground">{asset.mimeType}</p>
        {!disabled && (
          <Button type="button" variant="ghost" size="sm" onClick={onClear} className="-ml-2 h-7 text-destructive hover:bg-destructive/10 hover:text-destructive">
            <X className="h-3.5 w-3.5 mr-1" />
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

export function MediaPickerForm(props: FieldRenderProps) {
  const { control } = useFormContext();
  const [pickerOpen, setPickerOpen] = useState(false);
  const disabled = props.field.isReadonly;

  return (
    <div className="space-y-2">
      <Label htmlFor={props.field.fieldKey}>{fieldLabel(props)}</Label>
      <Controller
        control={control}
        name={props.field.fieldKey}
        render={({ field }) => {
          const value = typeof field.value === 'string' && field.value ? field.value : null;
          return (
            <div className="space-y-2">
              {value ? (
                <MediaPreview
                  assetId={value}
                  onClear={() => field.onChange(null)}
                  disabled={disabled}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  disabled={disabled}
                  className="flex h-20 w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-rule text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ImageIcon className="h-5 w-5" />
                  Pick media
                </button>
              )}
              {value && !disabled && (
                <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                  Replace
                </Button>
              )}
              <MediaPickerDialog
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                onSelect={(asset) => field.onChange(asset.id)}
              />
            </div>
          );
        }}
      />
    </div>
  );
}
