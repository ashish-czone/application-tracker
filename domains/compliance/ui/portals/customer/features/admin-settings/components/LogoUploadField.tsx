import { Upload, ImageIcon } from 'lucide-react';
import { Button } from '@packages/ui';

export function LogoUploadField() {
  return (
    <div className="flex items-center gap-4">
      <div className="w-[120px] h-[48px] border border-dashed border-rule bg-paper-sunken flex items-center justify-center">
        <ImageIcon className="w-5 h-5 text-ink-muted/50" strokeWidth={1.5} />
      </div>
      <div>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <Upload className="w-3 h-3" strokeWidth={1.5} />
          Upload logo
        </Button>
        <span className="block text-[10px] font-serif italic text-ink-muted mt-1.5">
          PNG, SVG, or JPG. Max 2 MB.
        </span>
      </div>
    </div>
  );
}
