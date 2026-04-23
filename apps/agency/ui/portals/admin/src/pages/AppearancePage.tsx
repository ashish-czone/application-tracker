import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@packages/ui';
import { useSettings, useUpdateSetting, useResetSetting } from '@packages/settings-ui';
import { ModePicker, CustomAccentPicker } from '@packages/theming-ui';
import {
  AGENCY_PRESETS,
  DEFAULT_SITE_THEME,
  TYPOGRAPHY_SCALES,
  resolveSiteThemeCss,
  isSiteThemeDark,
  type SiteTheme,
  type TypographyScale,
} from '@domains/agency-contract';

const RADIUS_OPTIONS = [
  { value: 0, label: 'None' },
  { value: 0.375, label: 'Small' },
  { value: 0.625, label: 'Medium' },
  { value: 1, label: 'Large' },
];

export default function AppearancePage() {
  const settings = useSettings();
  const updateSetting = useUpdateSetting();
  const resetSetting = useResetSetting();

  const savedTheme = useMemo<SiteTheme>(() => {
    const siteGroup = settings.data?.find((g) => g.module === 'site');
    const field = siteGroup?.fields.find((f) => f.key === 'theme');
    const raw = field?.value;
    if (raw && typeof raw === 'object') {
      return { ...DEFAULT_SITE_THEME, ...(raw as Partial<SiteTheme>) };
    }
    return DEFAULT_SITE_THEME;
  }, [settings.data]);

  const [draft, setDraft] = useState<SiteTheme | null>(null);
  const theme = draft ?? savedTheme;
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(savedTheme);

  function update(patch: Partial<SiteTheme>) {
    setDraft({ ...theme, ...patch });
  }

  function save() {
    updateSetting.mutate(
      { module: 'site', key: 'theme', value: theme },
      { onSuccess: () => setDraft(null) },
    );
  }

  function resetToDefault() {
    resetSetting.mutate(
      { module: 'site', key: 'theme' },
      { onSuccess: () => setDraft(null) },
    );
  }

  const isDark = isSiteThemeDark(theme, false);
  const previewStyle = resolveSiteThemeCss(theme, isDark) as Record<string, string>;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-foreground">Appearance</h1>
          <p className="text-sm text-muted-foreground">
            Controls the public site's theme. Visitors can override light/dark mode from the site header;
            everything else comes from here.
          </p>
        </div>
        {dirty && (
          <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
            Discard
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={resetToDefault}
          disabled={resetSetting.isPending}
        >
          Reset to default
        </Button>
        <Button size="sm" onClick={save} disabled={!dirty || updateSetting.isPending}>
          {updateSetting.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>Live sample of the public site theme.</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] border p-6"
            style={{
              ...previewStyle,
              background: 'hsl(var(--card))',
              color: 'hsl(var(--card-foreground))',
            }}
          >
            <Button>Primary action</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <span className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
              {isDark ? 'Dark mode' : 'Light mode'}
            </span>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Preset</h2>
          <p className="text-xs text-muted-foreground">Six curated palettes tuned for agency sites.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {AGENCY_PRESETS.map((preset) => {
            const active = theme.presetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => update({ presetId: preset.id, accentOverride: null })}
                className={`group relative flex flex-col items-start gap-2 rounded-[var(--radius)] border p-4 text-left transition-colors ${
                  active
                    ? 'border-primary ring-2 ring-primary/30'
                    : 'border-border hover:border-foreground/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-6 w-6 rounded-full border"
                    style={{ background: preset.swatch }}
                  />
                  <div className="text-sm font-medium text-foreground">{preset.name}</div>
                  {active && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground">{preset.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Default mode</h2>
          <p className="text-xs text-muted-foreground">
            The mode first-time visitors see. They can override via the header toggle.
          </p>
        </div>
        <ModePicker value={theme.mode} onChange={(mode) => update({ mode })} />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Typography</h2>
          <p className="text-xs text-muted-foreground">Named scales. Base font-size multiplies from the root.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {(Object.keys(TYPOGRAPHY_SCALES) as TypographyScale[]).map((scale) => {
            const meta = TYPOGRAPHY_SCALES[scale];
            const active = theme.typography === scale;
            return (
              <button
                key={scale}
                type="button"
                onClick={() => update({ typography: scale })}
                className={`flex flex-col items-start gap-1 rounded-[var(--radius)] border p-4 text-left transition-colors ${
                  active
                    ? 'border-primary ring-2 ring-primary/30'
                    : 'border-border hover:border-foreground/30'
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <div className="text-sm font-medium text-foreground">{meta.label}</div>
                  {active && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground">{meta.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Radius</h2>
          <p className="text-xs text-muted-foreground">Corner rounding across cards, buttons, and inputs.</p>
        </div>
        <div className="inline-flex gap-1 rounded-[var(--radius)] border border-border bg-muted/30 p-1">
          {RADIUS_OPTIONS.map((r) => {
            const active = theme.radius === r.value;
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => update({ radius: r.value })}
                className={`rounded-[calc(var(--radius)-0.25rem)] px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Custom accent</h2>
          <p className="text-xs text-muted-foreground">
            Override the preset's accent color. Clearing returns to the preset accent.
          </p>
        </div>
        <CustomAccentPicker
          value={theme.accentOverride}
          onChange={(hsl) => update({ accentOverride: hsl })}
        />
      </section>
    </div>
  );
}
