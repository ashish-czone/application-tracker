import { useState } from 'react';
import { ScreenLayout } from '@packages/ui';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';
import { SECTION_ICONS } from './components/settingsSectionIcons';
import { SettingsGroupSection } from './components/SettingsGroupSection';

interface Section {
  slug: string;
  label: string;
  description: string;
}

const SECTIONS: Section[] = [
  {
    slug: 'general',
    label: 'Localization',
    description:
      'Regional defaults for how dates, times, numbers, and currency are displayed across the platform.',
  },
  {
    slug: 'preferences',
    label: 'Preferences',
    description:
      'System-wide defaults that affect data display and reporting across the platform.',
  },
];

export function AdminSettingsPage() {
  const [activeSlug, setActiveSlug] = useState<string>(SECTIONS[0].slug);

  const active = SECTIONS.find((s) => s.slug === activeSlug) ?? SECTIONS[0];

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
            {SECTIONS.map((section) => {
              const Icon = SECTION_ICONS[section.slug];
              const isActive = activeSlug === section.slug;
              return (
                <button
                  key={section.slug}
                  type="button"
                  onClick={() => setActiveSlug(section.slug)}
                  className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                    isActive
                      ? 'bg-paper-raised text-ink border-r-2 border-authority'
                      : 'text-ink-soft hover:text-ink hover:bg-paper-raised/50'
                  }`}
                >
                  {Icon && (
                    <Icon
                      className={`w-4 h-4 flex-none ${isActive ? 'text-authority' : 'text-ink-muted'}`}
                      strokeWidth={1.5}
                    />
                  )}
                  <span className="text-sm font-sans">{section.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="flex-1 min-w-0 px-10 py-8">
          <SettingsGroupSection
            key={active.slug}
            moduleSlug={active.slug}
            description={active.description}
          />
        </div>
      </div>
    </ScreenLayout>
  );
}
