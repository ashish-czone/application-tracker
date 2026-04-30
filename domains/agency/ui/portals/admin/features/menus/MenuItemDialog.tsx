import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormSelect,
  Input,
  Label,
} from '@packages/ui';
import { usePagesForPicker } from './hooks';
import type { LinkType, MenuItemRecord, Target } from './types';

export interface MenuItemDialogValue {
  label: string;
  description: string | null;
  icon: string | null;
  linkType: LinkType;
  url: string | null;
  pageId: string | null;
  target: Target;
}

interface MenuItemDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  initial?: Partial<MenuItemRecord>;
  onCancel: () => void;
  onSubmit: (value: MenuItemDialogValue) => void;
  submitting?: boolean;
}

const LINK_TYPE_OPTIONS = [
  { value: 'url', label: 'Custom URL' },
  { value: 'page', label: 'Page' },
];

const TARGET_OPTIONS = [
  { value: '_self', label: 'Same tab' },
  { value: '_blank', label: 'New tab' },
];

/**
 * Curated set of lucide icons surfaced in the menu-item flyout. Kept tight
 * on purpose — admins should not pick from the full lucide catalogue, and
 * unknown values render as a generic dot in the customer site.
 */
const ICON_OPTIONS = [
  { value: '', label: 'No icon' },
  { value: 'globe', label: 'Globe (web)' },
  { value: 'smartphone', label: 'Smartphone (mobile)' },
  { value: 'sparkles', label: 'Sparkles (AI)' },
  { value: 'shopping-bag', label: 'Shopping bag (commerce)' },
  { value: 'megaphone', label: 'Megaphone (marketing)' },
  { value: 'palette', label: 'Palette (design)' },
  { value: 'rocket', label: 'Rocket' },
  { value: 'zap', label: 'Zap' },
  { value: 'wrench', label: 'Wrench' },
  { value: 'shield', label: 'Shield' },
  { value: 'users', label: 'Users' },
  { value: 'building', label: 'Building' },
];

export function MenuItemDialog({
  open,
  mode,
  initial,
  onCancel,
  onSubmit,
  submitting,
}: MenuItemDialogProps) {
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [linkType, setLinkType] = useState<LinkType>('url');
  const [url, setUrl] = useState('');
  const [pageId, setPageId] = useState<string | null>(null);
  const [target, setTarget] = useState<Target>('_self');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLabel(initial?.label ?? '');
    setDescription(initial?.description ?? '');
    setIcon(initial?.icon ?? '');
    setLinkType((initial?.linkType as LinkType | undefined) ?? 'url');
    setUrl(initial?.url ?? '');
    setPageId(initial?.pageId ?? null);
    setTarget((initial?.target as Target | undefined) ?? '_self');
    setError(null);
  }, [open, initial]);

  const pagesQuery = usePagesForPicker();
  const pageOptions = (pagesQuery.data?.data ?? []).map((p) => ({
    value: p.id,
    label: `${p.title} (${p.slug})`,
  }));

  const handleSubmit = () => {
    if (!label.trim()) {
      setError('Label is required');
      return;
    }
    if (linkType === 'url' && !url.trim()) {
      setError('URL is required for a custom link');
      return;
    }
    if (linkType === 'page' && !pageId) {
      setError('Pick a page');
      return;
    }
    onSubmit({
      label: label.trim(),
      description: description.trim() ? description.trim() : null,
      icon: icon || null,
      linkType,
      url: linkType === 'url' ? url.trim() : null,
      pageId: linkType === 'page' ? pageId : null,
      target,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add menu item' : 'Edit menu item'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="menu-item-label">Label</Label>
            <Input
              id="menu-item-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. About"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="menu-item-description">Description</Label>
            <textarea
              id="menu-item-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional. Shown under the label in the flyout menu."
              rows={2}
              maxLength={240}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Icon</Label>
            <FormSelect
              value={icon}
              onChange={(v) => setIcon(v ? String(v) : '')}
              options={ICON_OPTIONS}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Link type</Label>
            <FormSelect
              value={linkType}
              onChange={(v) => setLinkType((v as LinkType) || 'url')}
              options={LINK_TYPE_OPTIONS}
            />
          </div>
          {linkType === 'url' ? (
            <div className="space-y-1.5">
              <Label htmlFor="menu-item-url">URL</Label>
              <Input
                id="menu-item-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Page</Label>
              <FormSelect
                value={pageId ?? ''}
                onChange={(v) => setPageId(v ? String(v) : null)}
                options={pageOptions}
                placeholder={pagesQuery.isLoading ? 'Loading pages…' : 'Pick a page'}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Opens in</Label>
            <FormSelect
              value={target}
              onChange={(v) => setTarget((v as Target) || '_self')}
              options={TARGET_OPTIONS}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving…' : mode === 'create' ? 'Add item' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
