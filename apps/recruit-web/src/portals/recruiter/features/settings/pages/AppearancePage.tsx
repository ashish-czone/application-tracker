import { useNavigate, useLocation } from 'react-router';
import { ArrowLeft, Check, Moon, Sun, Monitor } from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@packages/ui';
import {
  useTheme,
  THEME_PRESETS,
  NEUTRAL_PRESETS,
  AUTO_NEUTRAL_ID,
  CURATED_FONTS,
  getFontById,
  type ThemeConfig,
  type ThemeMode,
  type FontScale,
} from '@packages/theming-ui';

const MODES: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
];

const FONT_SCALES: { id: FontScale; label: string; sampleSize: string }[] = [
  { id: 'sm', label: 'Small', sampleSize: 'text-sm' },
  { id: 'md', label: 'Medium', sampleSize: 'text-base' },
  { id: 'lg', label: 'Large', sampleSize: 'text-lg' },
];

const RADIUS_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'None' },
  { value: 0.375, label: 'Small' },
  { value: 0.625, label: 'Medium' },
  { value: 1, label: 'Large' },
];

export default function AppearancePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme, resetTheme, isDark } = useTheme();

  const cameFrom = (location.state as { from?: string } | null)?.from;

  function update(patch: Partial<ThemeConfig>) {
    setTheme({ ...theme, ...patch });
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center gap-3">
        {cameFrom && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(cameFrom)}
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-foreground">Appearance</h1>
          <p className="text-sm text-muted-foreground">
            Customize colors, typography, and shape. Changes apply immediately and are saved to your profile.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => resetTheme()}>
          Reset to default
        </Button>
      </div>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>Live sample of your current theme.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] border bg-card p-6">
            <Button>Primary action</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Badge>Badge</Badge>
            <span className="text-sm text-muted-foreground">Your current mode: {isDark ? 'Dark' : 'Light'}</span>
          </div>
        </CardContent>
      </Card>

      {/* Preset */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Preset</h2>
          <p className="text-xs text-muted-foreground">Start from a curated palette.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {THEME_PRESETS.map((preset) => {
            const active = theme.presetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  update({
                    presetId: preset.id,
                    neutralId: AUTO_NEUTRAL_ID,
                    overrides: undefined,
                  })
                }
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

      {/* Base neutral */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Base neutral</h2>
          <p className="text-xs text-muted-foreground">
            Controls background, text, borders, and sidebar surfaces. "Auto" inherits
            the accent preset's tinted base.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <button
            type="button"
            onClick={() => update({ neutralId: AUTO_NEUTRAL_ID })}
            className={`group relative flex flex-col items-start gap-2 rounded-[var(--radius)] border p-4 text-left transition-colors ${
              theme.neutralId === AUTO_NEUTRAL_ID
                ? 'border-primary ring-2 ring-primary/30'
                : 'border-border hover:border-foreground/30'
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className="h-6 w-6 rounded-full border"
                style={{
                  background:
                    'conic-gradient(from 180deg, hsl(240 6% 60%), hsl(210 14% 60%), hsl(140 10% 60%), hsl(30 12% 60%), hsl(265 14% 60%), hsl(240 6% 60%))',
                }}
              />
              <div className="text-sm font-medium text-foreground">Auto</div>
              {theme.neutralId === AUTO_NEUTRAL_ID && (
                <Check className="h-3.5 w-3.5 text-primary" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">Match preset tint</p>
          </button>
          {NEUTRAL_PRESETS.map((neutral) => {
            const active = theme.neutralId === neutral.id;
            return (
              <button
                key={neutral.id}
                type="button"
                onClick={() => update({ neutralId: neutral.id })}
                className={`group relative flex flex-col items-start gap-2 rounded-[var(--radius)] border p-4 text-left transition-colors ${
                  active
                    ? 'border-primary ring-2 ring-primary/30'
                    : 'border-border hover:border-foreground/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-6 w-6 rounded-full border"
                    style={{ background: neutral.swatch }}
                  />
                  <div className="text-sm font-medium text-foreground">{neutral.name}</div>
                  {active && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground">{neutral.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Mode */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Mode</h2>
          <p className="text-xs text-muted-foreground">Match the OS or pin a preference.</p>
        </div>
        <div className="inline-flex gap-1 rounded-[var(--radius)] border border-border bg-muted/30 p-1">
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = theme.mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => update({ mode: m.id })}
                className={`flex items-center gap-1.5 rounded-[calc(var(--radius)-0.25rem)] px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {m.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Typography */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Typography</h2>
          <p className="text-xs text-muted-foreground">Font family and text scale.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {CURATED_FONTS.map((font) => {
            const active = theme.fontFamily === font.id;
            return (
              <button
                key={font.id}
                type="button"
                onClick={() => update({ fontFamily: font.id })}
                className={`flex items-center justify-between rounded-[var(--radius)] border p-4 text-left transition-colors ${
                  active
                    ? 'border-primary ring-2 ring-primary/30'
                    : 'border-border hover:border-foreground/30'
                }`}
              >
                <div>
                  <div className="text-sm font-medium text-foreground" style={{ fontFamily: font.stack }}>
                    {font.name}
                  </div>
                  <div className="text-xs text-muted-foreground" style={{ fontFamily: font.stack }}>
                    The quick brown fox jumps over the lazy dog
                  </div>
                </div>
                {active && <Check className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>

        <div>
          <div className="mb-2 text-xs text-muted-foreground">Text scale</div>
          <div className="inline-flex gap-1 rounded-[var(--radius)] border border-border bg-muted/30 p-1">
            {FONT_SCALES.map((s) => {
              const active = theme.fontScale === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => update({ fontScale: s.id })}
                  className={`rounded-[calc(var(--radius)-0.25rem)] px-3 py-1.5 ${s.sampleSize} transition-colors ${
                    active
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Radius */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Radius</h2>
          <p className="text-xs text-muted-foreground">How rounded corners should be.</p>
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

      {/* Custom accent override */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Custom accent</h2>
          <p className="text-xs text-muted-foreground">
            Override the preset's primary color. Clearing this returns to the preset.
          </p>
        </div>
        <CustomAccentPicker
          current={theme.overrides?.accent?.primary ?? null}
          onChange={(hsl) => {
            if (hsl === null) {
              update({ overrides: { ...theme.overrides, accent: undefined } });
              return;
            }
            update({
              overrides: {
                ...theme.overrides,
                accent: {
                  ...theme.overrides?.accent,
                  primary: hsl,
                  primaryForeground: '0 0% 100%',
                  ring: hsl,
                  sidebarAccent: hsl,
                  sidebarAccentForeground: '0 0% 100%',
                },
              },
            });
          }}
        />
      </section>

      {/* Preferred font fallback hint */}
      <p className="text-xs text-muted-foreground">
        Font:{' '}
        <span style={{ fontFamily: getFontById(theme.fontFamily).stack }}>
          {getFontById(theme.fontFamily).name}
        </span>
      </p>
    </div>
  );
}

// ───────────────────────────────────────────────────────────

const ACCENT_SWATCHES: { label: string; hsl: string }[] = [
  { label: 'Rose', hsl: '346 77% 50%' },
  { label: 'Red', hsl: '0 84% 55%' },
  { label: 'Orange', hsl: '22 90% 52%' },
  { label: 'Amber', hsl: '38 92% 50%' },
  { label: 'Lime', hsl: '85 78% 42%' },
  { label: 'Emerald', hsl: '152 65% 40%' },
  { label: 'Teal', hsl: '175 70% 41%' },
  { label: 'Cyan', hsl: '190 90% 45%' },
  { label: 'Blue', hsl: '210 90% 50%' },
  { label: 'Indigo', hsl: '232 75% 58%' },
  { label: 'Violet', hsl: '262 70% 60%' },
  { label: 'Fuchsia', hsl: '295 75% 55%' },
];

function CustomAccentPicker({
  current,
  onChange,
}: {
  current: string | null;
  onChange: (hsl: string | null) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {ACCENT_SWATCHES.map((s) => {
          const active = current === s.hsl;
          return (
            <button
              key={s.hsl}
              type="button"
              onClick={() => onChange(s.hsl)}
              aria-label={s.label}
              title={s.label}
              className={`relative h-9 w-9 rounded-full border-2 transition-transform hover:scale-105 ${
                active ? 'border-foreground' : 'border-border'
              }`}
              style={{ background: `hsl(${s.hsl})` }}
            >
              {active && <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" />}
            </button>
          );
        })}
      </div>
      {current !== null && (
        <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
          Clear override
        </Button>
      )}
    </div>
  );
}
