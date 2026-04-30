import { useState, type ComponentType } from 'react';
import { ScreenLayout } from '@packages/ui';
import { ScreenPreviewTopBar } from '../shared/ScreenPreviewTopBar';
import { SETTINGS_SECTIONS, type SettingsSection } from './types';
import { SETTINGS_SECTION_ICONS } from './components/settingsSectionIcons';
import { ProfileSection } from './components/ProfileSection';
import { SecuritySection } from './components/SecuritySection';
import { NotificationsSection } from './components/NotificationsSection';
import { AppearanceSection } from './components/AppearanceSection';
import { ActivityLogSection } from './components/ActivityLogSection';

const SECTION_CONTENT: Record<SettingsSection, ComponentType> = {
  profile: ProfileSection,
  security: SecuritySection,
  notifications: NotificationsSection,
  appearance: AppearanceSection,
  activity: ActivityLogSection,
};

export function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile');

  const Content = SECTION_CONTENT[activeSection];

  return (
    <ScreenLayout
      topBar={<ScreenPreviewTopBar active="dashboard" />}
      breadcrumb={['Account', 'Settings']}
      title="Settings"
      subtitle="Manage your account, security, and preferences."
    >
      <div className="flex gap-0 border border-rule bg-paper-raised">
        <nav className="w-[220px] flex-none border-r border-rule bg-paper">
          <div className="py-2">
            {SETTINGS_SECTIONS.map((s) => {
              const Icon = SETTINGS_SECTION_ICONS[s.key];
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
          <Content />
        </div>
      </div>
    </ScreenLayout>
  );
}
