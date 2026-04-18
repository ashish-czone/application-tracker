import { Building2, Globe, SlidersHorizontal } from 'lucide-react';
import type { AdminSettingsSection } from '../data/adminSettingsMock';

export const SECTION_ICONS: Record<AdminSettingsSection, typeof Building2> = {
  organization: Building2,
  localization: Globe,
  preferences: SlidersHorizontal,
};
