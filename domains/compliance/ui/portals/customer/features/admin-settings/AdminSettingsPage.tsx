import { useEffect, useState } from 'react';
import { ScreenLayout } from '@packages/ui';
import { useSettings } from '@packages/settings-ui';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';
import {
  SECTION_ICONS,
  DEFAULT_SECTION_ICON,
  SECTION_DESCRIPTIONS,
} from './components/settingsSectionIcons';
import { SettingsGroupSection } from './components/SettingsGroupSection';

export function AdminSettingsPage() {
  const { data: groups = [], isLoading, error } = useSettings();
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  // Initialise / re-anchor the active section once groups load. If the user's
  // current selection is no longer in the list (group removed), fall back to
  // the first group.
  useEffect(() => {
    if (groups.length === 0) {
      if (activeSlug !== null) setActiveSlug(null);
      return;
    }
    if (!activeSlug || !groups.some((g) => g.module === activeSlug)) {
      setActiveSlug(groups[0].module);
    }
  }, [groups, activeSlug]);

  const activeGroup = groups.find((g) => g.module === activeSlug) ?? null;
  const activeDescription = activeGroup
    ? SECTION_DESCRIPTIONS[activeGroup.module] ?? ''
    : '';

  return (
    <ScreenLayout
      topBar={<ScreenPreviewTopBar active="dashboard" />}
      breadcrumb={['Workspace', 'Admin Settings']}
      title="Admin Settings"
      subtitle="Platform-wide configuration for your organization. Changes here affect all users."
    >
      <div className="flex gap-0 border border-rule bg-paper-raised">
        <nav className="w-[220px] flex-none border-r border-rule bg-paper">
          <div className="py-2">
            {isLoading && groups.length === 0 ? (
              <p className="px-5 py-2.5 text-[11px] font-mono tracking-tabular text-ink-muted">
                Loading sections…
              </p>
            ) : error ? (
              <p className="px-5 py-2.5 text-[11px] font-mono tracking-tabular text-ink-muted">
                Could not load settings.
              </p>
            ) : groups.length === 0 ? (
              <p className="px-5 py-2.5 text-[11px] font-serif italic text-ink-soft">
                No settings registered.
              </p>
            ) : (
              groups.map((group) => {
                const Icon = SECTION_ICONS[group.module] ?? DEFAULT_SECTION_ICON;
                const isActive = activeSlug === group.module;
                return (
                  <button
                    key={group.module}
                    type="button"
                    onClick={() => setActiveSlug(group.module)}
                    className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                      isActive
                        ? 'bg-paper-raised text-ink border-r-2 border-authority'
                        : 'text-ink-soft hover:text-ink hover:bg-paper-raised/50'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 flex-none ${isActive ? 'text-authority' : 'text-ink-muted'}`}
                      strokeWidth={1.5}
                    />
                    <span className="text-sm font-sans">{group.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </nav>

        <div className="flex-1 min-w-0 px-10 py-8">
          {activeGroup ? (
            <SettingsGroupSection
              key={activeGroup.module}
              moduleSlug={activeGroup.module}
              description={activeDescription}
            />
          ) : null}
        </div>
      </div>
    </ScreenLayout>
  );
}
