import { useNavigate, useLocation } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@packages/ui';
import { useTheme } from '../ThemeProvider';
import { AUTO_NEUTRAL_ID } from '../neutrals';
import { getFontById } from '../fonts';
import { PresetPicker } from '../components/PresetPicker';
import { NeutralPicker } from '../components/NeutralPicker';
import { ModePicker } from '../components/ModePicker';
import { TypographyPicker } from '../components/TypographyPicker';
import { RadiusPicker } from '../components/RadiusPicker';
import { CustomAccentPicker } from '../components/CustomAccentPicker';
import { ThemePreview } from '../components/ThemePreview';
import type { ThemeConfig } from '../types';

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

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>Live sample of your current theme.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemePreview theme={theme} isDark={isDark} />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Preset</h2>
          <p className="text-xs text-muted-foreground">Start from a curated palette.</p>
        </div>
        <PresetPicker
          value={theme.presetId}
          onChange={(presetId) =>
            update({ presetId, neutralId: AUTO_NEUTRAL_ID, overrides: undefined })
          }
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Base neutral</h2>
          <p className="text-xs text-muted-foreground">
            Controls background, text, borders, and sidebar surfaces. "Auto" inherits
            the accent preset's tinted base.
          </p>
        </div>
        <NeutralPicker value={theme.neutralId} onChange={(neutralId) => update({ neutralId })} />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Mode</h2>
          <p className="text-xs text-muted-foreground">Match the OS or pin a preference.</p>
        </div>
        <ModePicker value={theme.mode} onChange={(mode) => update({ mode })} />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Typography</h2>
          <p className="text-xs text-muted-foreground">Font family and text scale.</p>
        </div>
        <TypographyPicker
          fontFamily={theme.fontFamily}
          fontScale={theme.fontScale}
          onFontFamily={(fontFamily) => update({ fontFamily })}
          onFontScale={(fontScale) => update({ fontScale })}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Radius</h2>
          <p className="text-xs text-muted-foreground">How rounded corners should be.</p>
        </div>
        <RadiusPicker value={theme.radius} onChange={(radius) => update({ radius })} />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Custom accent</h2>
          <p className="text-xs text-muted-foreground">
            Override the preset's primary color. Clearing this returns to the preset.
          </p>
        </div>
        <CustomAccentPicker
          value={theme.overrides?.accent?.primary ?? null}
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

      <p className="text-xs text-muted-foreground">
        Font:{' '}
        <span style={{ fontFamily: getFontById(theme.fontFamily).stack }}>
          {getFontById(theme.fontFamily).name}
        </span>
      </p>
    </div>
  );
}
