import { useState } from 'react';
import { ScreenLayout } from '@packages/ui';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';
import {
  ADMIN_SETTINGS_SECTIONS,
  type AdminSettingsSection,
} from './data/adminSettingsMock';
import { SECTION_ICONS } from './components/settingsSectionIcons';
import { SettingsGroupSection } from './components/SettingsGroupSection';

export function AdminSettingsPage() {
  const [activeSection, setActiveSection] = useState<AdminSettingsSection>('organization');

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
            {ADMIN_SETTINGS_SECTIONS.map((s) => {
              const Icon = SECTION_ICONS[s.key];
              const isActive = activeSection === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setActiveSection(s.key)}
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
                  <span className="text-sm font-sans">{s.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="flex-1 min-w-0 px-10 py-8">
          <SettingsGroupSection sectionKey={activeSection} />
        </div>
      </div>
    </ScreenLayout>
  );
}
