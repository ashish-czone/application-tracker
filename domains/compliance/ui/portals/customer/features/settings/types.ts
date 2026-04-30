/**
 * Section enum + nav metadata for the SettingsPage. Mock data arrays that
 * lived alongside this in placeholders.ts have been retired — see PR-C in
 * the platform-shaped screens phase.
 */
export type SettingsSection =
  | 'profile'
  | 'security'
  | 'notifications'
  | 'appearance'
  | 'activity';

export const SETTINGS_SECTIONS: { key: SettingsSection; label: string }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'security', label: 'Security' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'appearance', label: 'Appearance' },
  { key: 'activity', label: 'Activity log' },
];

export type ThemeMode = 'light' | 'dark' | 'system';
export type Density = 'comfortable' | 'compact';
