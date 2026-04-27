import { User, ShieldCheck, Bell, Palette, ScrollText, type LucideIcon } from 'lucide-react';
import type { SettingsSection } from '../data/settingsMock';

export const SETTINGS_SECTION_ICONS: Record<SettingsSection, LucideIcon> = {
  profile: User,
  security: ShieldCheck,
  notifications: Bell,
  appearance: Palette,
  activity: ScrollText,
};
