import { useMemo, useState } from 'react';
import { Image as ImageIcon, X } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@packages/ui';
import { useSettings, useUpdateSetting, useResetSetting } from '@packages/settings-ui';
import { MediaPickerDialog, useMediaAsset } from '@packages/media-library-ui-admin';
import type { MediaAssetRecord } from '@packages/media-library-ui-admin';

interface MediaSettingDef {
  key: 'companyLogo' | 'defaultSeo.ogImage';
  title: string;
  description: string;
  recommendation?: string;
}

const MEDIA_SETTINGS: readonly MediaSettingDef[] = [
  {
    key: 'companyLogo',
    title: 'Company logo',
    description:
      'Used in the JSON-LD Organization schema and anywhere the public site needs the brand mark.',
    recommendation: 'Transparent PNG or SVG, square aspect recommended.',
  },
  {
    key: 'defaultSeo.ogImage',
    title: 'Default Open Graph image',
    description:
      'Fallback social-share image used when a page does not set its own OG image.',
    recommendation: 'Recommended size 1200×630, JPEG or PNG.',
  },
] as const;

export default function BrandingPage() {
  const settings = useSettings();
  const updateSetting = useUpdateSetting();
  const resetSetting = useResetSetting();

  const valuesByKey = useMemo(() => {
    const siteGroup = settings.data?.find((g) => g.module === 'site');
    const map: Record<string, string> = {};
    if (!siteGroup) return map;
    for (const def of MEDIA_SETTINGS) {
      const field = siteGroup.fields.find((f) => f.key === def.key);
      const raw = field?.value;
      map[def.key] = typeof raw === 'string' ? raw : '';
    }
    return map;
  }, [settings.data]);

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Branding</h1>
        <p className="text-sm text-muted-foreground">
          Media assets used by the public site. Pick from the library or upload a new file.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {MEDIA_SETTINGS.map((def) => (
          <MediaSettingCard
            key={def.key}
            def={def}
            assetId={valuesByKey[def.key] ?? ''}
            saving={updateSetting.isPending}
            resetting={resetSetting.isPending}
            onSelect={(asset) =>
              updateSetting.mutate({ module: 'site', key: def.key, value: asset.id })
            }
            onClear={() => resetSetting.mutate({ module: 'site', key: def.key })}
          />
        ))}
      </div>
    </div>
  );
}

interface MediaSettingCardProps {
  def: MediaSettingDef;
  assetId: string;
  saving: boolean;
  resetting: boolean;
  onSelect: (asset: MediaAssetRecord) => void;
  onClear: () => void;
}

function MediaSettingCard({ def, assetId, saving, resetting, onSelect, onClear }: MediaSettingCardProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{def.title}</CardTitle>
        <CardDescription>{def.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <MediaPreview assetId={assetId} />
        {def.recommendation && (
          <p className="text-xs text-muted-foreground">{def.recommendation}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setPickerOpen(true)} disabled={saving}>
            {assetId ? 'Replace' : 'Select media'}
          </Button>
          {assetId && (
            <Button size="sm" variant="outline" onClick={onClear} disabled={resetting}>
              <X className="mr-1 h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>
        <MediaPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onSelect={(asset) => {
            onSelect(asset);
            setPickerOpen(false);
          }}
        />
      </CardContent>
    </Card>
  );
}

function MediaPreview({ assetId }: { assetId: string }) {
  const { data: asset, isLoading } = useMediaAsset(assetId || undefined);

  if (!assetId) {
    return (
      <div className="flex h-40 w-full items-center justify-center rounded-lg border-2 border-dashed border-rule bg-muted/30 text-sm text-muted-foreground">
        <ImageIcon className="mr-2 h-5 w-5" />
        Not set
      </div>
    );
  }

  if (isLoading) {
    return <div className="h-40 w-full animate-pulse rounded-lg bg-muted" />;
  }

  if (!asset) {
    return (
      <div className="flex h-40 w-full items-center justify-center rounded-lg border border-destructive/40 bg-destructive/5 text-sm text-destructive">
        Referenced asset is missing from the library.
      </div>
    );
  }

  const isImage = asset.mimeType.startsWith('image/');

  return (
    <div className="flex items-start gap-4">
      <div className="h-40 w-40 shrink-0 overflow-hidden rounded-lg border border-rule bg-paper-raised">
        {isImage ? (
          <img
            src={asset.url}
            alt={asset.altText ?? asset.originalName}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageIcon className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1 text-sm">
        <p className="truncate font-medium text-foreground">{asset.originalName}</p>
        <p className="text-xs text-muted-foreground">{asset.mimeType}</p>
        {asset.width && asset.height && (
          <p className="text-xs text-muted-foreground">
            {asset.width} × {asset.height}
          </p>
        )}
      </div>
    </div>
  );
}
